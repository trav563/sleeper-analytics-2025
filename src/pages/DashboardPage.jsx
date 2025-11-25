import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { displayTeamName } from '../utils/nflData';
import WidgetLineupStatus from '../features/dashboard/components/WidgetLineupStatus';
import WidgetMatchupPreview from '../features/dashboard/components/WidgetMatchupPreview';
import WidgetQuickStats from '../features/dashboard/components/WidgetQuickStats';
import WidgetLeagueTicker from '../features/dashboard/components/WidgetLeagueTicker';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';

const DashboardPage = () => {
    const { users, rosters, matchups, players, state, transactions, loading, error, user, league } = useOutletContext();
    const [selectedUserId, setSelectedUserId] = useState('');

    const week = state?.display_week || state?.week || 1;
    const { seasonMatchups } = useSeasonMatchups(league?.league_id, week);

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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">League Dashboard</h1>
                    <p className="text-sm text-slate-400">Week {week} Overview</p>
                </div>

                <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
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

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Hero & Stats */}
                <div className="space-y-6">
                    {/* Hero Widget: Lineup Status */}
                    <WidgetLineupStatus
                        week={week}
                        users={users}
                        rosters={rosters}
                        matchups={matchups}
                        players={players}
                        selectedUserId={selectedUserId}
                    />

                    {/* Quick Stats Row */}
                    <WidgetQuickStats
                        rosters={rosters}
                        selectedUserId={selectedUserId}
                        league={league}
                        currentWeek={week}
                    />
                </div>

                {/* Right Column: Matchup & Ticker */}
                <div className="space-y-6">
                    {/* Matchup Preview */}
                    <WidgetMatchupPreview
                        week={week}
                        users={users}
                        rosters={rosters}
                        matchups={matchups}
                        selectedUserId={selectedUserId}
                        players={players}
                        seasonMatchups={seasonMatchups}
                    />

                    {/* League Ticker */}
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
