import { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TrueStandings from '../features/analytics/components/TrueStandings';
import TeamRadar from '../features/analytics/components/TeamRadar';
import RivalryMatrix from '../features/analytics/components/RivalryMatrix';
import LeaguePerformanceChart from '../features/analytics/components/LeaguePerformanceChart';
import PerformanceTrendChart from '../features/analytics/components/PerformanceTrendChart';

import { displayTeamName } from '../utils/nflData';
import { fetchAllMatchups } from '../utils/sleeper';
import { Card, CardContent } from '../components/ui/Card';
import { CalendarClock, ArrowRight } from 'lucide-react';

const AnalyticsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, user, currentWeek } = useOutletContext();

    // Default to current user's roster ID, or the first roster if user not found
    const [selectedRosterId, setSelectedRosterId] = useState(null);
    const [comparisonMode, setComparisonMode] = useState('league'); // 'league' | 'h2h'
    const [opponentRosterId, setOpponentRosterId] = useState(null);

    // Fetch Weekly Matchups for Chart
    const { data: weeklyMatchups } = useQuery({
        queryKey: ['weeklyMatchups', leagueId, currentWeek],
        queryFn: () => fetchAllMatchups(leagueId, currentWeek),
        staleTime: 60 * 60 * 1000, // 1 hour
        enabled: !!leagueId && !!currentWeek
    });

    useEffect(() => {
        if (!rosters || rosters.length === 0) return;

        // If we already have a selection that is valid, don't change it
        if (selectedRosterId && rosters.find(r => r.roster_id === selectedRosterId)) return;

        // Try to match current user
        if (user) {
            const userRoster = rosters.find(r => r.owner_id === user.user_id);
            if (userRoster) {
                setSelectedRosterId(userRoster.roster_id);
                return;
            }
        }

        // Fallback to first roster
        setSelectedRosterId(rosters[0].roster_id);
    }, [rosters, user, selectedRosterId]);

    const handleTeamChange = (e) => {
        setSelectedRosterId(Number(e.target.value));
    };

    const handleOpponentChange = (e) => {
        setOpponentRosterId(Number(e.target.value));
    };

    const selectedUser = users?.find(u => u.user_id === rosters?.find(r => r.roster_id === selectedRosterId)?.owner_id);
    const opponentUser = users?.find(u => u.user_id === rosters?.find(r => r.roster_id === opponentRosterId)?.owner_id);

    const isOffseason = !currentWeek || currentWeek === 0 || league?.status === 'pre_draft';

    if (isOffseason) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                <Card className="bg-slate-900/80 border-slate-700 max-w-lg text-center backdrop-blur-sm">
                    <CardContent className="pt-10 pb-10 px-8 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 mb-2">
                            <CalendarClock className="w-8 h-8 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">The {league?.season} Offseason is Here</h2>
                        <p className="text-slate-400">
                            Matchup data, true standings, and rivalry matrices will activate once the {league?.season} season officially kicks off.
                        </p>
                        {league?.previous_league_id && (
                            <a 
                                href={`/league/${league.previous_league_id}/analytics`}
                                className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-lg shadow-blue-900/20"
                            >
                                View {parseInt(league.season) - 1} Analytics <ArrowRight className="w-4 h-4" />
                            </a>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Team Selector Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/50 p-5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-xl">
                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Team Analysis</h2>
                    <p className="text-sm text-slate-400">Select a team to view their positional strength</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {/* Comparison Mode Toggle */}
                    <div className="flex bg-slate-950/80 rounded-full p-1 self-start sm:self-center border border-slate-800">
                        <button
                            onClick={() => setComparisonMode('league')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${comparisonMode === 'league' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            vs League
                        </button>
                        <button
                            onClick={() => setComparisonMode('h2h')}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${comparisonMode === 'h2h' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Head-to-Head
                        </button>
                    </div>

                    <div className="flex gap-2 items-center w-full sm:w-auto">
                        <select
                            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-full focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-48 px-4 py-2 appearance-none"
                            value={selectedRosterId || ''}
                            onChange={handleTeamChange}
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                        >
                            {rosters?.map(roster => {
                                const rosterUser = users?.find(u => u.user_id === roster.owner_id);
                                return (
                                    <option key={roster.roster_id} value={roster.roster_id}>
                                        {displayTeamName(rosterUser)}
                                    </option>
                                );
                            })}
                        </select>

                        {comparisonMode === 'h2h' && (
                            <>
                                <span className="text-slate-400 font-bold px-2">VS</span>
                                <select
                                    className="bg-slate-900 border border-slate-700 text-white text-sm rounded-full focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-48 px-4 py-2 appearance-none"
                                    value={opponentRosterId || ''}
                                    onChange={handleOpponentChange}
                                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                                >
                                    <option value="" disabled>Select Opponent</option>
                                    {rosters?.filter(r => r.roster_id !== selectedRosterId).map(roster => {
                                        const rosterUser = users?.find(u => u.user_id === roster.owner_id);
                                        return (
                                            <option key={roster.roster_id} value={roster.roster_id}>
                                                {displayTeamName(rosterUser)}
                                            </option>
                                        );
                                    })}
                                </select>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <TrueStandings
                    leagueId={leagueId}
                    currentWeek={currentWeek}
                    rosters={rosters}
                    users={users}
                    weeklyMatchups={weeklyMatchups}
                    league={league}
                />
                <TeamRadar
                    leagueId={leagueId}
                    currentWeek={currentWeek}
                    rosters={rosters}
                    players={players}
                    userRosterId={selectedRosterId}
                    opponentRosterId={comparisonMode === 'h2h' ? opponentRosterId : null}
                    opponentTeamName={comparisonMode === 'h2h' ? displayTeamName(opponentUser) : null}
                    users={users}
                />
            </div>

            <RivalryMatrix
                currentUserId={user?.user_id}
                users={users}
                selectedUser1Id={selectedUser?.user_id}
                selectedUser2Id={comparisonMode === 'h2h' ? opponentUser?.user_id : null}
                leagueId={leagueId}
            />



            {/* Advanced Metrics Section */}
            <div className="pt-8 border-t border-slate-700">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    Advanced Metrics
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                        BETA
                    </span>
                </h2>

                <div className="space-y-8">
                    <PerformanceTrendChart
                        weeklyMatchups={weeklyMatchups}
                        rosters={rosters}
                        users={users}
                        user={user}
                    />
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
