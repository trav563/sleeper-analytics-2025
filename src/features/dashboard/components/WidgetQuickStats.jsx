import { useMemo } from 'react';
import { Trophy, TrendingUp, BarChart2, HelpCircle } from 'lucide-react';
import { usePlayoffOdds } from '../hooks/usePlayoffOdds';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';

const WidgetQuickStats = ({ rosters, selectedUserId, league, currentWeek, seasonMatchups }) => {
    const { odds, loading: oddsLoading } = usePlayoffOdds(league, rosters, currentWeek);

    const stats = useMemo(() => {
        if (!selectedUserId || !Array.isArray(rosters)) return null;

        const roster = rosters.find(r => r.owner_id === selectedUserId);
        if (!roster) return null;

        const sortedRosters = [...rosters].sort((a, b) => {
            if (a.settings.wins !== b.settings.wins) return b.settings.wins - a.settings.wins;
            return (b.settings.fpts + (b.settings.fpts_decimal || 0) / 100) - (a.settings.fpts + (a.settings.fpts_decimal || 0) / 100);
        });

        const rank = sortedRosters.findIndex(r => r.roster_id === roster.roster_id) + 1;

        // Calculate real streak from matchup data
        let streak = '—';
        if (seasonMatchups && Object.keys(seasonMatchups).length > 0) {
            let streakCount = 0;
            let streakType = null; // 'W' or 'L'
            const weeks = Object.keys(seasonMatchups).map(Number).sort((a, b) => b - a);
            for (const week of weeks) {
                const weekData = seasonMatchups[week];
                if (!weekData) continue;
                const userMatch = weekData.find(m => m.roster_id === roster.roster_id);
                if (!userMatch || userMatch.matchup_id == null) continue;
                const opponent = weekData.find(m => m.matchup_id === userMatch.matchup_id && m.roster_id !== roster.roster_id);
                if (!opponent) continue;
                // Skip weeks where neither team has scored (future/unplayed)
                if ((userMatch.points || 0) === 0 && (opponent.points || 0) === 0) continue;
                const won = (userMatch.points || 0) > (opponent.points || 0);
                const result = won ? 'W' : 'L';
                if (streakType === null) {
                    streakType = result;
                    streakCount = 1;
                } else if (result === streakType) {
                    streakCount++;
                } else {
                    break;
                }
            }
            if (streakCount > 0) {
                streak = `${streakCount}${streakType}`;
            }
        }

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
    }, [selectedUserId, rosters, odds, seasonMatchups]);

    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="h-full bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2 border-b border-slate-700">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Current Rank</CardTitle>
                        <Trophy className="w-4 h-4 text-yellow-500" />
                    </div>
                </CardHeader>
                <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-white">#{stats.rank}</div>
                    <p className="text-xs text-slate-400 mt-1">
                        {stats.wins}-{stats.losses}{stats.ties > 0 ? `-${stats.ties}` : ''}
                    </p>
                </CardContent>
            </Card>

            <Card className="relative group cursor-help transition-all hover:bg-muted/50 bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2 border-b border-slate-700">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Playoff Odds</CardTitle>
                        <BarChart2 className={`w-4 h-4 ${stats.playoffStatus === 'Clinched' ? 'text-green-500' : stats.playoffStatus === 'Eliminated' ? 'text-destructive' : 'text-blue-400'}`} />
                    </div>
                </CardHeader>
                <CardContent className="pt-6 text-center">
                    <div className={`text-3xl font-bold ${stats.playoffStatus === 'Clinched' ? 'text-green-500' : stats.playoffStatus === 'Eliminated' ? 'text-destructive' : 'text-white'}`}>
                        {oddsLoading ? '...' : stats.playoffOddsDisplay}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                        Monte Carlo Simulation
                        <HelpCircle className="w-3 h-3" />
                    </div>
                </CardContent>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 bg-popover text-xs text-left text-popover-foreground rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity w-64 pointer-events-none z-20 border border-border">
                    <p className="font-semibold mb-1">Monte Carlo Simulation</p>
                    <p>Simulates the remaining schedule 10,000 times based on each team's Average Points Per Game.</p>
                </div>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2 border-b border-slate-700">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Streak</CardTitle>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                </CardHeader>
                <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-white">{stats.streak}</div>
                    <div className="text-xs text-slate-400 mt-1">Current Streak</div>
                </CardContent>
            </Card>
        </div>
    );
};

export default WidgetQuickStats;
