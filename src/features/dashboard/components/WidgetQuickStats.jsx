import { useMemo } from 'react';
import { Trophy, TrendingUp, BarChart2, HelpCircle } from 'lucide-react';
import { usePlayoffOdds } from '../hooks/usePlayoffOdds';

const WidgetQuickStats = ({ rosters, selectedUserId, league, currentWeek }) => {
    const { odds, loading: oddsLoading } = usePlayoffOdds(league, rosters, currentWeek);

    const stats = useMemo(() => {
        if (!selectedUserId || !Array.isArray(rosters)) return null;

        const roster = rosters.find(r => r.owner_id === selectedUserId);
        if (!roster) return null;

        // Calculate Rank based on wins and total points
        const sortedRosters = [...rosters].sort((a, b) => {
            if (a.settings.wins !== b.settings.wins) return b.settings.wins - a.settings.wins;
            return (b.settings.fpts + (b.settings.fpts_decimal || 0) / 100) - (a.settings.fpts + (a.settings.fpts_decimal || 0) / 100);
        });

        const rank = sortedRosters.findIndex(r => r.roster_id === roster.roster_id) + 1;
        const streak = Math.max(1, (roster.roster_id * 3) % 5) + 'W'; // Placeholder streak logic, keep for now or fix if needed

        // Get Simulated Odds
        let playoffOddsDisplay = '...';
        let playoffStatus = '';

        if (odds && odds[roster.roster_id]) {
            const data = odds[roster.roster_id];
            playoffOddsDisplay = `${data.percent}%`;
            if (data.status === 'Clinched') playoffStatus = 'Clinched';
            if (data.status === 'Eliminated') playoffStatus = 'Eliminated';
        }

        return {
            rank,
            wins: roster.settings.wins,
            losses: roster.settings.losses,
            playoffOddsDisplay,
            playoffStatus,
            streak
        };
    }, [selectedUserId, rosters, odds]);

    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center text-center">
                <Trophy className="w-5 h-5 text-yellow-500 mb-2" />
                <div className="text-2xl font-bold text-white">#{stats.rank}</div>
                <div className="text-xs text-slate-500">Current Rank</div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center text-center relative group cursor-help">
                <BarChart2 className={`w-5 h-5 mb-2 ${stats.playoffStatus === 'Clinched' ? 'text-green-500' : stats.playoffStatus === 'Eliminated' ? 'text-red-500' : 'text-blue-500'}`} />
                <div className={`text-2xl font-bold ${stats.playoffStatus === 'Clinched' ? 'text-green-400' : stats.playoffStatus === 'Eliminated' ? 'text-red-400' : 'text-white'}`}>
                    {oddsLoading ? '...' : stats.playoffOddsDisplay}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                    Playoff Odds
                    <HelpCircle className="w-3 h-3" />
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 bg-slate-900 text-xs text-left text-slate-300 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity w-64 pointer-events-none z-20 border border-slate-700">
                    <p className="font-semibold text-white mb-1">Monte Carlo Simulation</p>
                    <p>Simulates the remaining schedule 10,000 times based on each team's Average Points Per Game.</p>
                    <div className="mt-2 pt-2 border-t border-slate-800">
                        <p>Top 6 teams make playoffs.</p>
                        <p>Tiebreaker: Record, then Total PF.</p>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                </div>
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
