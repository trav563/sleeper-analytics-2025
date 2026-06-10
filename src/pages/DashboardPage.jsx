import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { displayTeamName } from '../utils/nflData';
import WidgetLineupStatus from '../features/dashboard/components/WidgetLineupStatus';
import WidgetMatchupPreview from '../features/dashboard/components/WidgetMatchupPreview';
import WidgetQuickStats from '../features/dashboard/components/WidgetQuickStats';
import WidgetLeagueTicker from '../features/dashboard/components/WidgetLeagueTicker';
import RosterNews from '../features/dashboard/components/RosterNews';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';
import { fetchLeagueMatchups } from '../utils/sleeper';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import TeamRoster from '../features/dashboard/components/TeamRoster';
import SeasonResultsBanner from '../features/league/components/SeasonResultsBanner';
import TeamAnalyzer from '../features/tools/components/TeamAnalyzer';
import LineupChecker from '../features/league/components/LineupChecker';
import { ChevronDown, ChevronUp } from 'lucide-react';

const DashboardPage = () => {
    const { users, rosters, matchups: currentWeekMatchups, players, state, transactions, loading, error, user, league, refresh } = useOutletContext();
    const [selectedUserId, setSelectedUserId] = useState('');
    const [showFullLineup, setShowFullLineup] = useState(false);

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

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading Dashboard...</div>;
    if (error) return (
        <div className="p-8 text-center space-y-3">
            <p className="text-destructive font-medium">Error loading dashboard data.</p>
            <button
                onClick={refresh}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
                Retry
            </button>
        </div>
    );

    // Generate Week Options (1 to 18)
    const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);

    // Resolve Selected User for Analysis
    const selectedUserObj = users?.find(u => u.user_id === selectedUserId);

    return (
        <div className="space-y-6">
            {/* Season Results Banner (if season complete) */}
            <SeasonResultsBanner league={league} rosters={rosters} users={users} />

            {/* Header & Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">League Dashboard</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-muted-foreground">
                            {selectedWeek === currentNFLWeek ? 'Current Week Overview' : `Week ${selectedWeek} History`}
                        </p>
                        {selectedWeek !== currentNFLWeek && (
                            <Badge variant="secondary">Time Travel Active</Badge>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Week Selector */}
                    <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border border-border">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-2">Week</span>
                        <select
                            className="bg-transparent text-sm font-medium text-foreground rounded-md border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pl-1 pr-8"
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                        >
                            {weekOptions.map(w => (
                                <option key={w} value={w}>
                                    {w} {w === currentNFLWeek ? '(Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* User Selector */}
                    <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border border-border">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-2">View As</span>
                        <select
                            className="bg-transparent text-sm font-medium text-foreground rounded-md border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pl-1 pr-8"
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
                    {/* NEW: AI Team Analyzer */}
                    <TeamAnalyzer
                        league={league}
                        roster={rosters?.find(r => r.owner_id === selectedUserId)}
                    />

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

                    {/* Full League Lineup Check — Collapsible */}
                    <Card className="border-border/50">
                        <button
                            onClick={() => setShowFullLineup(!showFullLineup)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
                        >
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">League Lineup Check</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">View lineup status for all teams</p>
                            </div>
                            {showFullLineup ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>
                        {showFullLineup && (
                            <CardContent className="pt-0">
                                <LineupChecker
                                    state={state}
                                    users={users}
                                    rosters={rosters}
                                    matchups={viewMatchups}
                                    players={players}
                                    league={league}
                                    loading={loading}
                                    error={error}
                                    refresh={refresh}
                                />
                            </CardContent>
                        )}
                    </Card>

                    {/* Team Roster with Dossier */}
                    <TeamRoster
                        roster={rosters?.find(r => r.owner_id === selectedUserId)}
                        players={players}
                        users={users}
                        currentWeek={selectedWeek}
                        transactions={transactions}
                        seasonMatchups={seasonMatchups}
                        league={league}
                        rosters={rosters}
                    />
                </div>

                {/* Right Column: Matchup & Ticker */}
                <div className="space-y-6">
                    {/* Matchup Preview */}
                    <div className={`transition-opacity duration-300 ${loadingMatchups ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
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
                    <RosterNews
                        roster={rosters?.find(r => r.owner_id === selectedUserId)}
                        players={players}
                    />

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
