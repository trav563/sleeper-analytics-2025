import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { displayTeamName } from '../utils/nflData';
import WidgetLineupStatus from '../features/dashboard/components/WidgetLineupStatus';
import WidgetMatchupPreview from '../features/dashboard/components/WidgetMatchupPreview';
import WidgetQuickStats from '../features/dashboard/components/WidgetQuickStats';
import WidgetLeagueTicker from '../features/dashboard/components/WidgetLeagueTicker';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';
import { fetchLeagueMatchups } from '../utils/sleeper';

const DashboardPage = () => {
    const { users, rosters, matchups: currentWeekMatchups, players, state, transactions, loading, error, user, league } = useOutletContext();
    const [selectedUserId, setSelectedUserId] = useState('');

    // Global State: Current NFL Week
    const currentNFLWeek = state?.display_week || state?.week || 1;

    // Local State: Selected Week for Time Travel
    const [selectedWeek, setSelectedWeek] = useState(currentNFLWeek);
    const [viewMatchups, setViewMatchups] = useState([]);
    const [loadingMatchups, setLoadingMatchups] = useState(false);

    // Sync selectedWeek with currentNFLWeek on initial load
    useEffect(() => {
        if (state?.display_week) {
            setSelectedWeek(state.display_week);
        }
    }, [state?.display_week]);

    // Fetch Matchups when Selected Week Changes
    useEffect(() => {
        const loadMatchups = async () => {
            if (!league?.league_id || !selectedWeek) return;

            // Optimization: If selected week is current week, use context data
            if (selectedWeek === currentNFLWeek && currentWeekMatchups.length > 0) {
                setViewMatchups(currentWeekMatchups);
                return;
            }

            setLoadingMatchups(true);
            try {
                const data = await fetchLeagueMatchups(league.league_id, selectedWeek);
                setViewMatchups(data);
            } catch (err) {
                console.error("Failed to fetch matchups for week", selectedWeek, err);
            } finally {
                setLoadingMatchups(false);
            }
        };

        loadMatchups();
    }, [selectedWeek, league?.league_id, currentNFLWeek, currentWeekMatchups]);

    // Fetch historical data for projections (always needed for smart projections)
    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentNFLWeek);

    // Default to logged-in user if available, otherwise first user
    useEffect(() => {
        if (users && users.length > 0 && !selectedUserId) {
            if (user?.user_id) {
                setSelectedUserId(user.user_id);
            } else {
                setSelectedUserId(users[0].user_id);
            }
        }
    }, [users, user, selectedUserId]);

    if (loading) return <div className="p-8 text-center text-slate-400">Loading Dashboard...</div>;
    if (error) return <div className="p-8 text-center text-red-400">Error loading dashboard data.</div>;

    // Generate Week Options (1 to 18)
    const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">League Dashboard</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-slate-400">
                            {selectedWeek === currentNFLWeek ? 'Current Week Overview' : `Week ${selectedWeek} History`}
                        </p>
                        {selectedWeek !== currentNFLWeek && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                Time Travel Active
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Week Selector */}
                    <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider pl-2">Week:</span>
                        <select
                            className="bg-slate-700 text-white text-sm rounded-md border-none focus:ring-2 focus:ring-blue-500 py-1.5 pl-3 pr-8"
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                        >
                            {weekOptions.map(w => (
                                <option key={w} value={w}>
                                    Week {w} {w === currentNFLWeek ? '(Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* User Selector */}
                    <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider pl-2">Viewing As:</span>
                        <select
                            className="bg-slate-700 text-white text-sm rounded-md border-none focus:ring-2 focus:ring-blue-500 py-1.5 pl-3 pr-8"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                        >
                            {users?.map(user => (
                                <option key={user.user_id} value={user.user_id}>
                                    {displayTeamName(user)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Hero & Stats */}
                <div className="space-y-6">
                    {/* Hero Widget: Lineup Status */}
                    <WidgetLineupStatus
                        week={selectedWeek}
                        users={users}
                        rosters={rosters}
                        matchups={viewMatchups}
                        players={players}
                        selectedUserId={selectedUserId}
                    />

                    {/* Quick Stats Row */}
                    <WidgetQuickStats
                        rosters={rosters}
                        selectedUserId={selectedUserId}
                        league={league}
                        currentWeek={selectedWeek}
                    />
                </div>

                {/* Right Column: Matchup & Ticker */}
                <div className="space-y-6">
                    {/* Matchup Preview */}
                    <div className={`transition-opacity duration-200 ${loadingMatchups ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <WidgetMatchupPreview
                            week={selectedWeek}
                            currentNFLWeek={currentNFLWeek}
                            users={users}
                            rosters={rosters}
                            matchups={viewMatchups}
                            selectedUserId={selectedUserId}
                            players={players}
                            seasonMatchups={seasonMatchups}
                        />
                    </div>

                    {/* League Ticker - Always shows latest transactions, independent of time travel */}
                    <WidgetLeagueTicker
                        transactions={transactions}
                        users={users}
                        rosters={rosters}
                        players={players}
                    />
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
