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
import TeamRoster from '../features/dashboard/components/TeamRoster';
import AnalyzeMyTeam from '../features/dashboard/components/AnalyzeMyTeam';

const DashboardPage = () => {
    const { users, rosters, matchups: currentWeekMatchups, players, state, transactions, loading, error, user, league } = useOutletContext();
    const [selectedUserId, setSelectedUserId] = useState('');

    const currentNFLWeek = state?.display_week || state?.week || 1;

    const [selectedWeek, setSelectedWeek] = useState(currentNFLWeek);
    const [viewMatchups, setViewMatchups] = useState([]);
    const [loadingMatchups, setLoadingMatchups] = useState(false);

    useEffect(() => {
        if (state?.display_week) {
            setSelectedWeek(state.display_week);
        }
    }, [state?.display_week]);

    useEffect(() => {
        const loadMatchups = async () => {
            if (!league?.league_id || !selectedWeek) return;

            if (selectedWeek === currentNFLWeek && currentWeekMatchups.length > 0) {
                setViewMatchups(currentWeekMatchups);
                return;
            }

            setLoadingMatchups(true);
            try {
                const data = await fetchLeagueMatchups(league.league_id, selectedWeek);
                setViewMatchups(data);
            } catch (err) {
                console.error('Failed to fetch matchups for week', selectedWeek, err);
            } finally {
                setLoadingMatchups(false);
            }
        };

        loadMatchups();
    }, [selectedWeek, league?.league_id, currentNFLWeek, currentWeekMatchups]);

    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentNFLWeek);

    useEffect(() => {
        if (users && users.length > 0 && !selectedUserId) {
            if (user?.user_id) {
                setSelectedUserId(user.user_id);
            } else {
                setSelectedUserId(users[0].user_id);
            }
        }
    }, [users, user, selectedUserId]);

    if (loading) {
        return (
            <div className="p-8 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                Loading dashboard…
            </div>
        );
    }
    if (error) {
        return (
            <div className="p-8 text-center font-mono text-2xs uppercase tracking-wider text-bad">
                Error loading dashboard data
            </div>
        );
    }

    const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);
    const isTimeTraveling = selectedWeek !== currentNFLWeek;

    return (
        <div className="space-y-5">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-5">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        {isTimeTraveling
                            ? <>Time Travel · Week <span className="tnum text-signal">{selectedWeek}</span></>
                            : <>Current Week Overview</>}
                    </div>
                    <h1 className="mt-1 font-display text-3xl font-bold tracking-snug text-text">
                        League Dashboard
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 bg-bg-2 px-2.5 py-1 rounded-md border border-line">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Week</span>
                        <select
                            className="bg-transparent text-sm font-semibold text-text border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pr-6 tnum"
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                        >
                            {weekOptions.map(w => (
                                <option key={w} value={w}>
                                    {w}{w === currentNFLWeek ? ' (Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="inline-flex items-center gap-2 bg-bg-2 px-2.5 py-1 rounded-md border border-line">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">View as</span>
                        <select
                            className="bg-transparent text-sm font-semibold text-text border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pr-6"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                        >
                            {users?.map(u => (
                                <option key={u.user_id} value={u.user_id}>
                                    {displayTeamName(u)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-5">
                    <WidgetLineupStatus
                        week={selectedWeek}
                        users={users}
                        rosters={rosters}
                        matchups={viewMatchups}
                        players={players}
                        selectedUserId={selectedUserId}
                    />

                    <AnalyzeMyTeam
                        leagueId={league?.league_id}
                        userId={selectedUserId}
                        week={selectedWeek}
                    />

                    <WidgetQuickStats
                        rosters={rosters}
                        selectedUserId={selectedUserId}
                        league={league}
                        currentWeek={selectedWeek}
                        seasonMatchups={seasonMatchups}
                        state={state}
                    />

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

                <div className="space-y-5">
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
