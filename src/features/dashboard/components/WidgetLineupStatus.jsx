import { useMemo } from 'react';
import { useLineupStatus } from '../../league/hooks/useLineupStatus';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';

const WidgetLineupStatus = ({ week, users, rosters, matchups, players, selectedUserId }) => {
    const { grouped } = useLineupStatus(week, users, rosters, matchups, players);

    const status = useMemo(() => {
        if (!selectedUserId || !grouped) return null;

        const isOk = grouped.OK.some(item => item.owner_id === selectedUserId);
        const isPotential = grouped.POTENTIAL.some(item => item.owner_id === selectedUserId);
        const isIncomplete = grouped.INCOMPLETE.some(item => item.owner_id === selectedUserId);

        if (isIncomplete) {
            const details = grouped.INCOMPLETE.find(item => item.owner_id === selectedUserId);
            const issues = (details?.flagged || []).map(f => f.reason === "Empty Slot" ? f.reason : `${f.name} (${f.reason})`);
            return { type: 'error', message: 'Lineup Incomplete', details: issues, icon: XCircle, variant: 'destructive', className: 'border-destructive/50 bg-destructive/10 text-destructive' };
        }
        if (isPotential) {
            const details = grouped.POTENTIAL.find(item => item.owner_id === selectedUserId);
            const issues = (details?.flagged || []).map(f => `${f.name} (${f.reason})`);
            return { type: 'warning', message: 'Potential Issues', details: issues, icon: AlertTriangle, variant: 'warning', className: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500' };
        }
        if (isOk) {
            return { type: 'success', message: 'Lineup Set', details: [], icon: CheckCircle, variant: 'success', className: 'border-green-500/50 bg-green-500/10 text-green-500' };
        }
        return null;
    }, [grouped, selectedUserId]);

    const statusInfo = useMemo(() => {
        if (!status) return { label: '', message: '', details: null, color: '', bgColor: '' };

        switch (status.type) {
            case 'error':
                return {
                    label: status.message,
                    message: "Your lineup has incomplete slots or critical issues.",
                    details: status.details.join(', '),
                    color: 'text-red-500',
                    bgColor: 'bg-red-950/20'
                };
            case 'warning':
                return {
                    label: status.message,
                    message: "Some players may not be optimally set or have minor issues.",
                    details: status.details.join(', '),
                    color: 'text-yellow-500',
                    bgColor: 'bg-yellow-950/20'
                };
            case 'success':
                return {
                    label: status.message,
                    message: `Your starting lineup is optimized and ready for Week ${week}.`,
                    details: null,
                    color: 'text-green-500',
                    bgColor: 'bg-green-950/20'
                };
            default:
                return { label: '', message: '', details: null, color: '', bgColor: '' };
        }
    }, [status, week]);

    if (!status) return null;

    const StatusIcon = status.icon;
    const { color: statusColor, bgColor } = statusInfo;

    return (
        <Card className={`border-slate-700 ${bgColor}`}>
            <CardHeader className="pb-2 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                    <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                    <CardTitle className={`text-lg font-bold ${statusColor}`}>
                        {statusInfo.label}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <p className="text-slate-300 text-sm">
                    {statusInfo.message}
                </p>
                {statusInfo.details && (
                    <div className="mt-2 text-xs text-slate-400">
                        {statusInfo.details}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WidgetLineupStatus;
