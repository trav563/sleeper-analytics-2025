import { useMemo } from 'react';
import { ArrowRightLeft, PlusCircle, MinusCircle } from 'lucide-react';

const WidgetLeagueTicker = ({ transactions, users, rosters, players }) => {
    const recentActivity = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        const sorted = [...transactions]
            .filter(tx => tx.status === 'complete' && (tx.type === 'trade' || (tx.adds && Object.keys(tx.adds).length > 0) || (tx.drops && Object.keys(tx.drops).length > 0)))
            .sort((a, b) => b.created - a.created)
            .slice(0, 20);

        const getTeamName = (rosterId) => {
            if (!rosters || !users) return `Team ${rosterId}`;
            const roster = rosters.find(r => r.roster_id === rosterId);
            if (!roster) return `Team ${rosterId}`;
            const user = users.find(u => u.user_id === roster.owner_id);
            return user ? user.display_name : `Team ${rosterId}`;
        };

        const getTimeAgo = (date) => {
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + 'y ago';
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + 'mo ago';
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + 'd ago';
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + 'h ago';
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + 'm ago';
            return Math.floor(seconds) + 's ago';
        };

        return sorted.map(tx => {
            const date = new Date(tx.created);
            const timeAgo = getTimeAgo(date);
            let type = 'unknown';
            let desc = '';

            if (tx.type === 'trade') {
                type = 'trade';
                const involvedTeams = tx.roster_ids.map(rid => getTeamName(rid));
                const playerNames = Object.keys(tx.adds || {}).map(pid => {
                    const player = players?.[pid];
                    return player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
                }).join(', ');
                desc = `Trade involving ${involvedTeams.join(' & ')}: ${playerNames}`;
            } else if (tx.type === 'free_agent' || tx.type === 'waiver') {
                const added = tx.adds ? Object.keys(tx.adds) : [];
                const dropped = tx.drops ? Object.keys(tx.drops) : [];

                if (added.length > 0 && dropped.length > 0) {
                    type = 'add';
                    const pAdd = players?.[added[0]];
                    const pDrop = players?.[dropped[0]];
                    const addName = pAdd ? `${pAdd.first_name} ${pAdd.last_name}` : 'Unknown';
                    const dropName = pDrop ? `${pDrop.first_name} ${pDrop.last_name}` : 'Unknown';
                    const rosterId = tx.adds[added[0]];
                    const teamName = getTeamName(rosterId);
                    desc = `${teamName} added ${addName}, dropped ${dropName}`;
                } else if (added.length > 0) {
                    type = 'add';
                    const p = players?.[added[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';
                    const rosterId = tx.adds[added[0]];
                    const teamName = getTeamName(rosterId);
                    desc = `${teamName} ${tx.type === 'waiver' ? 'waived' : 'added'} ${name}`;
                } else if (dropped.length > 0) {
                    type = 'drop';
                    const p = players?.[dropped[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';
                    const rosterId = tx.drops[dropped[0]];
                    const teamName = getTeamName(rosterId);
                    desc = `${teamName} dropped ${name}`;
                }
            }
            return { type, desc, time: timeAgo };
        });
    }, [transactions, users, rosters, players]);

    const getIcon = (type) => {
        switch (type) {
            case 'trade': return <ArrowRightLeft className="w-4 h-4 text-signal-2" aria-hidden="true" />;
            case 'add':   return <PlusCircle className="w-4 h-4 text-good" aria-hidden="true" />;
            case 'drop':  return <MinusCircle className="w-4 h-4 text-bad" aria-hidden="true" />;
            default:      return <PlusCircle className="w-4 h-4 text-text-mute" aria-hidden="true" />;
        }
    };

    if (!transactions || transactions.length === 0) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line shadow-card">
                <header className="px-4 pt-3 pb-2 border-b border-line">
                    <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute">League Activity</h3>
                </header>
                <div className="px-4 py-6 text-sm text-text-mute text-center">
                    No recent activity
                </div>
            </section>
        );
    }

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card">
            <header className="px-4 pt-3 pb-2 border-b border-line">
                <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute">League Activity</h3>
            </header>
            <div className="px-4 py-3 space-y-3">
                {recentActivity.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-3 border-b border-line last:border-0 last:pb-0">
                        <div className="mt-0.5 shrink-0">{getIcon(item.type)}</div>
                        <div className="min-w-0">
                            <p className="text-sm text-text leading-snug">{item.desc}</p>
                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">{item.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default WidgetLeagueTicker;
