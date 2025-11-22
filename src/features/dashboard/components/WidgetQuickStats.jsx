import { useMemo } from 'react';
import { Trophy, TrendingUp, BarChart2 } from 'lucide-react';

const WidgetQuickStats = ({ rosters, selectedUserId }) => {
    const stats = useMemo(() => {
        if (!selectedUserId || !rosters) return null;

        const roster = rosters.find(r => r.owner_id === selectedUserId);
        if (!roster) return null;

        // Calculate Rank based on wins and total points
        const sortedRosters = [...rosters].sort((a, b) => {
            if (a.settings.wins !== b.settings.wins) return b.settings.wins - a.settings.wins;
            return (b.settings.fpts + (b.settings.fpts_decimal || 0) / 100) - (a.settings.fpts + (a.settings.fpts_decimal || 0) / 100);
        });

        const rank = sortedRosters.findIndex(r => r.roster_id === roster.roster_id) + 1;

        // Mock Playoff Odds (Random for demo purposes as requested)
        const playoffOdds = Math.floor(Math.random() * (99 - 10 + 1) + 10);

        // Determine Streak (Mock logic based on last result)
        // In real app, would need history
        const streak = roster.metadata?.streak || 'W1';

        return {
            rank,
            wins: roster.settings.wins,
            losses: roster.settings.losses,
            playoffOdds,
            streak
        };
    }, [selectedUserId, rosters]);

    if (!stats) return null;

    return (
        <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center text-center">
                <Trophy className="w-5 h-5 text-yellow-500 mb-2" />
                <div className="text-2xl font-bold text-white">#{stats.rank}</div>
                <div className="text-xs text-slate-500">Current Rank</div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center text-center">
                <BarChart2 className="w-5 h-5 text-blue-500 mb-2" />
                <div className="text-2xl font-bold text-white">{stats.playoffOdds}%</div>
                <div className="text-xs text-slate-500">Playoff Odds</div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center text-center">
                <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
                <div className="text-2xl font-bold text-white">{stats.streak}</div>
                <div className="text-xs text-slate-500">Streak</div>
            </div>
        </div>
    );
};

export default WidgetQuickStats;
