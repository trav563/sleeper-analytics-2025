import { useMemo } from 'react';
import { useLineupStatus } from '../../league/hooks/useLineupStatus';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const TONE = {
    error:   { text: 'text-bad',  bg: 'bg-bad/10',  border: 'border-bad/40' },
    warning: { text: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/40' },
    success: { text: 'text-good', bg: 'bg-good/10', border: 'border-good/40' },
};

const WidgetLineupStatus = ({ week, users, rosters, matchups, players, selectedUserId }) => {
    const { grouped } = useLineupStatus(week, users, rosters, matchups, players);

    const status = useMemo(() => {
        if (!selectedUserId || !grouped) return null;

        const isOk = grouped.OK.some(item => item.owner_id === selectedUserId);
        const isPotential = grouped.POTENTIAL.some(item => item.owner_id === selectedUserId);
        const isIncomplete = grouped.INCOMPLETE.some(item => item.owner_id === selectedUserId);

        if (isIncomplete) {
            const details = grouped.INCOMPLETE.find(item => item.owner_id === selectedUserId);
            const issues = (details?.flagged || []).map(f => f.reason === 'Empty Slot' ? f.reason : `${f.name} (${f.reason})`);
            return {
                tone: 'error',
                label: 'Lineup Incomplete',
                message: 'Your lineup has incomplete slots or critical issues.',
                details: issues,
                icon: XCircle,
            };
        }
        if (isPotential) {
            const details = grouped.POTENTIAL.find(item => item.owner_id === selectedUserId);
            const issues = (details?.flagged || []).map(f => `${f.name} (${f.reason})`);
            return {
                tone: 'warning',
                label: 'Potential Issues',
                message: 'Some players may not be optimally set or have minor issues.',
                details: issues,
                icon: AlertTriangle,
            };
        }
        if (isOk) {
            return {
                tone: 'success',
                label: 'Lineup Set',
                message: `Your starting lineup is optimized and ready for Week ${week}.`,
                details: [],
                icon: CheckCircle,
            };
        }
        return null;
    }, [grouped, selectedUserId, week]);

    if (!status) return null;

    const t = TONE[status.tone];
    const StatusIcon = status.icon;

    return (
        <section className={`rounded-xl border ${t.border} ${t.bg} shadow-card`}>
            <header className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-line/60">
                <StatusIcon className={`w-5 h-5 ${t.text}`} aria-hidden="true" />
                <h3 className={`font-display text-lg font-bold ${t.text}`}>{status.label}</h3>
            </header>
            <div className="px-4 pb-4 pt-3">
                <p className="text-sm text-text-dim">{status.message}</p>
                {status.details && status.details.length > 0 && (
                    <div className="mt-2 font-mono text-2xs uppercase tracking-wider text-text-mute">
                        {status.details.join(' · ')}
                    </div>
                )}
            </div>
        </section>
    );
};

export default WidgetLineupStatus;
