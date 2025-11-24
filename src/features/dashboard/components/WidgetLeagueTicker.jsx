import { useMemo } from 'react';
import { ArrowRightLeft, PlusCircle, MinusCircle } from 'lucide-react';
import { displayTeamName } from '../../../utils/nflData';

const WidgetLeagueTicker = ({ transactions, users, rosters, players }) => {
    const recentActivity = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        // Filter for complete transactions only and sort by most recent
        const sorted = [...transactions]
            .filter(tx => tx.status === 'complete')
            .sort((a, b) => b.created - a.created)
            .slice(0, 20);

        const getTeamName = (rosterId) => {
            if (!rosters || !users) return `Team ${rosterId}`;
            const roster = rosters.find(r => r.roster_id === rosterId);
            if (!roster) return `Team ${rosterId}`;
            const user = users.find(u => u.user_id === roster.owner_id);
            return user ? displayTeamName(user) : `Team ${rosterId}`;
        };

        return sorted.map(tx => {
            const date = new Date(tx.created);
            const timeAgo = getTimeAgo(date);
            let type = 'unknown';
            let desc = '';

            if (tx.type === 'trade') {
                type = 'trade';
                const involvedTeams = tx.roster_ids.map(rid => getTeamName(rid));

                // Try to get player names
                const playerNames = Object.keys(tx.adds || {}).map(pid => {
                    const player = players?.[pid];
                    return player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
                }).join(', ');

                desc = `Trade involving ${involvedTeams.join(' & ')}: ${playerNames}`;
            } else if (tx.type === 'free_agent') {
                // Check if it's an add or drop (or both)
                const added = tx.adds ? Object.keys(tx.adds) : [];
                const dropped = tx.drops ? Object.keys(tx.drops) : [];

                if (added.length > 0 && dropped.length > 0) {
                    type = 'add'; // Treat swap as add
                    const pAdd = players?.[added[0]];
                    const pDrop = players?.[dropped[0]];
                    const addName = pAdd ? `${pAdd.first_name} ${pAdd.last_name}` : 'Unknown';
                    const dropName = pDrop ? `${pDrop.first_name} ${pDrop.last_name}` : 'Unknown';

                    // Get roster ID from the add transaction detail
                    const rosterId = tx.adds[added[0]];
                    const teamName = getTeamName(rosterId);

                    desc = `${teamName} added ${addName}, dropped ${dropName}`;
                } else if (added.length > 0) {
                    type = 'add';
                    const p = players?.[added[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';

                    const rosterId = tx.adds[added[0]];
                    const teamName = getTeamName(rosterId);

                    desc = `${teamName} added ${name}`;
                } else if (dropped.length > 0) {
                    type = 'drop';
                    const p = players?.[dropped[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';

                    const rosterId = tx.drops[dropped[0]];
                    const teamName = getTeamName(rosterId);

                    desc = `${teamName} dropped ${name}`;
                }
            } else if (tx.type === 'waiver') {
                // Similar logic to free_agent
                const added = tx.adds ? Object.keys(tx.adds) : [];

                if (added.length > 0) {
                    type = 'add';
                    const p = players?.[added[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';

                    const rosterId = tx.adds[added[0]];
                    const teamName = getTeamName(rosterId);

                    desc = `${teamName} claimed ${name} off waivers`;
                }
            }

            return { type, desc, time: timeAgo };
        });
    }, [transactions, users, rosters, players]);

    const getIcon = (type) => {
        switch (type) {
            case 'trade': return <ArrowRightLeft className="w-4 h-4 text-purple-400" />;
            case 'add': return <PlusCircle className="w-4 h-4 text-green-400" />;
            case 'drop': return <MinusCircle className="w-4 h-4 text-red-400" />;
            default: return <PlusCircle className="w-4 h-4 text-slate-400" />;
        }
    };

    if (!transactions || transactions.length === 0) {
        return (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">League Activity</h3>
                <div className="text-sm text-slate-500 text-center py-4">No recent activity</div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">League Activity</h3>
            <div className="space-y-4">
                {recentActivity.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-3 border-b border-slate-700/50 last:border-0 last:pb-0">
                        <div className="mt-0.5">{getIcon(item.type)}</div>
                        <div>
                            <p className="text-sm text-slate-200 leading-tight">{item.desc}</p>
                            <p className="text-xs text-slate-500 mt-1">{item.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Helper for time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
}

export default WidgetLeagueTicker;
