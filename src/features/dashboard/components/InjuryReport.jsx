import { Activity, Skull, AlertCircle, HelpCircle } from 'lucide-react';
import { PlayerHeadshot } from '../../../components/ui/PlayerHeadshot';

const STATUS_TONE = {
    IR:           'bg-bad/15 text-bad border-bad/40',
    Out:          'bg-bad/15 text-bad border-bad/30',
    Doubtful:     'bg-signal-2/15 text-signal-2 border-signal-2/30',
    Questionable: 'bg-warn/15 text-warn border-warn/30',
};
const defaultStatusTone = 'bg-bg-3 text-text-dim border-line';

const InjuryReport = ({ roster, players }) => {
    const injuredPlayers = (roster?.players || [])
        .map(pid => players?.[pid] ? { ...players[pid], player_id: pid } : null)
        .filter(p => p && p.position !== 'DEF' && (p.status !== 'Active' || p.injury_status))
        .sort((a, b) => {
            const priority = { IR: 5, Out: 4, Doubtful: 3, Questionable: 2, Sus: 1 };
            const statusA = a.injury_status || a.status;
            const statusB = b.injury_status || b.status;
            return (priority[statusB] || 0) - (priority[statusA] || 0);
        });

    if (!injuredPlayers.length) return null;

    const getStatusIcon = (status) => {
        switch (status) {
            case 'IR':           return <Skull className="w-3 h-3" />;
            case 'Out':          return <AlertCircle className="w-3 h-3" />;
            case 'Questionable': return <HelpCircle className="w-3 h-3" />;
            default:             return <Activity className="w-3 h-3" />;
        }
    };

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card mt-3">
            <header className="px-4 pt-3 pb-2 border-b border-line">
                <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-bad" aria-hidden="true" />
                    Injury Report
                </h3>
            </header>
            <div className="px-4 py-3 space-y-2">
                {injuredPlayers.map(p => {
                    const status = p.injury_status || p.status;
                    const tone = STATUS_TONE[status] || defaultStatusTone;
                    return (
                        <div key={p.player_id} className="flex items-center justify-between gap-2 bg-bg-2 p-2 rounded-md border border-line">
                            <div className="flex items-center gap-3 min-w-0">
                                <PlayerHeadshot playerId={p.player_id} name={`${p.first_name} ${p.last_name}`} size={32} />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text leading-none truncate">{p.first_name} {p.last_name}</p>
                                    <p className="font-mono text-2xs text-text-mute mt-1 uppercase tracking-wider">
                                        {p.team || 'FA'} · {p.position}
                                    </p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-sm font-mono text-2xs font-bold uppercase tracking-wider border shrink-0 ${tone}`}>
                                {getStatusIcon(status)}
                                {status}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default InjuryReport;
