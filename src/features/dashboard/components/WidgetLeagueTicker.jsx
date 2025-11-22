import { useMemo } from 'react';
import { ArrowRightLeft, PlusCircle, MinusCircle } from 'lucide-react';
import { displayTeamName } from '../../../utils/nflData';

const WidgetLeagueTicker = ({ transactions, users, players }) => {
    const recentActivity = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        // Sort by most recent (created)
        const sorted = [...transactions].sort((a, b) => b.created - a.created).slice(0, 5);

        return sorted.map(tx => {
            const date = new Date(tx.created);
            const timeAgo = getTimeAgo(date);
            let type = 'unknown';
            let desc = '';

            if (tx.type === 'trade') {
                type = 'trade';
                // Simplified trade description logic
                // In a real app, this would be more complex to show who got what
                const involvedTeams = tx.roster_ids.map(rid => {
                    const user = users?.find(u => u.user_id === tx.consenter_ids.find(cid => cid === u.user_id)); // This is imperfect mapping but works for now
                    // Better mapping: roster_id -> owner_id -> user
                    // We don't have rosters prop here, but we can try to map if we had it.
                    // For now, let's just say "Team A and Team B traded"
                    return `Team ${rid}`;
                });

                // Try to get player names
                const playerNames = Object.keys(tx.adds || {}).map(pid => {
                    const player = players?.[pid];
                    return player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
                }).join(', ');

                desc = `Trade involving ${playerNames}`;
            } else if (tx.type === 'free_agent') {
                // Check if it's an add or drop (or both)
                const added = tx.adds ? Object.keys(tx.adds) : [];
                const dropped = tx.drops ? Object.keys(tx.drops) : [];

                // Find the user who made the transaction
                const rosterId = tx.roster_ids[0];
                // We need rosters to map roster_id to user name correctly. 
                // Since we don't have rosters prop, we'll use a placeholder or generic name.
                // Ideally we pass rosters prop too.
                const teamName = `Team ${rosterId}`;

                if (added.length > 0 && dropped.length > 0) {
                    type = 'add'; // Treat swap as add
                    const pAdd = players?.[added[0]];
                    const pDrop = players?.[dropped[0]];
                    const addName = pAdd ? `${pAdd.first_name} ${pAdd.last_name}` : 'Unknown';
                    const dropName = pDrop ? `${pDrop.first_name} ${pDrop.last_name}` : 'Unknown';
                    desc = `${teamName} added ${addName}, dropped ${dropName}`;
                } else if (added.length > 0) {
                    type = 'add';
                    const p = players?.[added[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';
                    desc = `${teamName} added ${name}`;
                } else if (dropped.length > 0) {
                    type = 'drop';
                    const p = players?.[dropped[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';
                    desc = `${teamName} dropped ${name}`;
                }
            } else if (tx.type === 'waiver') {
                // Similar logic to free_agent
                const added = tx.adds ? Object.keys(tx.adds) : [];
                const rosterId = tx.roster_ids[0];
                const teamName = `Team ${rosterId}`;

                if (added.length > 0) {
                    type = 'add';
                    const p = players?.[added[0]];
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Unknown';
                    desc = `${teamName} claimed ${name} off waivers`;
                }
            }

            return { type, desc, time: timeAgo };
        });
    }, [transactions, users, players]);

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
