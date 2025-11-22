import { useMemo } from 'react';
import { useLineupStatus } from '../../league/hooks/useLineupStatus';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const WidgetLineupStatus = ({ week, users, rosters, matchups, players, selectedUserId }) => {
    const { grouped } = useLineupStatus(week, users, rosters, matchups, players);

    const status = useMemo(() => {
        if (!selectedUserId || !grouped) return null;

        // Check which group the selected user falls into
        const isOk = grouped.OK.some(item => item.team.owner_id === selectedUserId);
        const isPotential = grouped.POTENTIAL.some(item => item.team.owner_id === selectedUserId);
        const isIncomplete = grouped.INCOMPLETE.some(item => item.team.owner_id === selectedUserId);

        if (isIncomplete) {
            const details = grouped.INCOMPLETE.find(item => item.team.owner_id === selectedUserId);
            return { type: 'error', message: 'Lineup Incomplete', details: details?.issues, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
        }
        if (isPotential) {
            const details = grouped.POTENTIAL.find(item => item.team.owner_id === selectedUserId);
            return { type: 'warning', message: 'Potential Issues', details: details?.issues, icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
        }
        if (isOk) {
            return { type: 'success', message: 'Lineup Set', details: [], icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
        }
        return null;
    }, [grouped, selectedUserId]);

    if (!status) return null;

    const Icon = status.icon;

    return (
        <div className={`rounded-xl border ${status.border} ${status.bg} p-6 transition-all duration-300 hover:shadow-lg hover:shadow-${status.color}/5`}>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className={`text-lg font-bold ${status.color} flex items-center gap-2`}>
                        <Icon className="w-6 h-6" />
                        {status.message}
                    </h3>
                    {status.details && status.details.length > 0 ? (
                        <ul className="mt-3 space-y-1">
                            {status.details.map((issue, idx) => (
                                <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                    {issue}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-sm text-slate-400">Your starting lineup is optimized and ready for Week {week}.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WidgetLineupStatus;
