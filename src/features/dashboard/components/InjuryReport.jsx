import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Activity, Skull, AlertCircle, HelpCircle } from 'lucide-react';
import { avatarUrl } from '../../../utils/nflData';

const InjuryReport = ({ roster, players }) => {
    // 1. Filter Injured Players
    const injuredPlayers = (roster?.players || [])
        .map(pid => players?.[pid])
        .filter(p => p && (p.status !== 'Active' || p.injury_status))
        .sort((a, b) => {
            // Sort Priority: IR > Out > Doubtful > Questionable > Sus > Other
            const priority = { 'IR': 5, 'Out': 4, 'Doubtful': 3, 'Questionable': 2, 'Sus': 1 };
            const statusA = a.injury_status || a.status;
            const statusB = b.injury_status || b.status;
            return (priority[statusB] || 0) - (priority[statusA] || 0);
        });

    if (!injuredPlayers.length) return null;

    const getStatusColor = (status) => {
        switch (status) {
            case 'IR': return 'bg-red-900/50 text-red-200 border-red-700/50';
            case 'Out': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'Doubtful': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
            case 'Questionable': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            default: return 'bg-slate-700 text-slate-300';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'IR': return <Skull className="w-3 h-3" />;
            case 'Out': return <AlertCircle className="w-3 h-3" />;
            case 'Questionable': return <HelpCircle className="w-3 h-3" />;
            default: return <Activity className="w-3 h-3" />;
        }
    };

    return (
        <Card className="bg-slate-800/50 border-slate-700 w-full mt-4">
            <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                    <Activity className="w-5 h-5 text-red-400" />
                    Injury Report
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {injuredPlayers.map(p => {
                    const status = p.injury_status || p.status;
                    return (
                        <div key={p.player_id} className="flex items-center justify-between bg-slate-900/30 p-2 rounded border border-slate-800">
                            <div className="flex items-center gap-3">
                                <img
                                    src={avatarUrl(p.player_id)}
                                    alt={p.last_name}
                                    className="w-8 h-8 rounded-full border border-slate-700"
                                />
                                <div>
                                    <p className="text-sm font-bold text-white leading-none">{p.first_name} {p.last_name}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{p.team || 'FA'} • {p.position}</p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase border ${getStatusColor(status)}`}>
                                {getStatusIcon(status)}
                                {status}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};

export default InjuryReport;
