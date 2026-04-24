import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { displayTeamName } from '../utils/nflData';
import MyMatchupHero from '../features/dashboard/components/MyMatchupHero';
import LeaguePulse from '../features/dashboard/components/LeaguePulse';
import LineupToday from '../features/dashboard/components/LineupToday';
import Insights from '../features/dashboard/components/Insights';
import StandingsStrip from '../features/dashboard/components/StandingsStrip';
import QuickStats4 from '../features/dashboard/components/QuickStats4';
import RosterNews from '../features/dashboard/components/RosterNews';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';
import { fetchLeagueMatchups } from '../utils/sleeper';

const DashboardPage = () => {
    const { users, rosters, matchups: currentWeekMatchups, players, state, loading, error, user, league } = useOutletContext();
    const [selectedUserId, setSelectedUserId] = useState('');

    const currentNFLWeek = state?.display_week || state?.week || 1;
    const [selectedWeek, setSelectedWeek] = useState(currentNFLWeek);
    const [viewMatchups, setViewMatchups] = useState([]);
    const [loadingMatchups, setLoadingMatchups] = useState(false);

    useEffect(() => {
        if (state?.display_week) setSelectedWeek(state.display_week);
    }, [state?.display_week]);

    useEffect(() => {
        if (!league?.league_id || !selectedWeek) return;
        if (selectedWeek === currentNFLWeek && currentWeekMatchups?.length > 0) {
            setViewMatchups(currentWeekMatchups);
            return;
        }
        let cancelled = false;
        setLoadingMatchups(true);
        fetchLeagueMatchups(league.league_id, selectedWeek)
            .then((data) => { if (!cancelled) setViewMatchups(data || []); })
            .catch((err) => { if (!cancelled) console.error('Failed to fetch matchups', err); })
            .finally(() => { if (!cancelled) setLoadingMatchups(false); });
        return () => { cancelled = true; };
    }, [selectedWeek, league?.league_id, currentNFLWeek, currentWeekMatchups]);

    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentNFLWeek);

    useEffect(() => {
        if (users && users.length > 0 && !selectedUserId) {
            setSelectedUserId(user?.user_id || users[0].user_id);
        }
    }, [users, user, selectedUserId]);

    const myRoster = useMemo(
        () => rosters?.find((r) => r.owner_id === selectedUserId) || null,
        [rosters, selectedUserId]
    );

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
            {/* Header */}
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
                            {weekOptions.map((w) => (
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
                            {users?.map((u) => (
                                <option key={u.user_id} value={u.user_id}>
                                    {displayTeamName(u)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </header>

            {/* Two-column body matching design composition */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
                {/* LEFT column: Hero → LeaguePulse → LineupToday (mobile) → Insights */}
                <div className={`flex flex-col gap-4 min-w-0 ${loadingMatchups ? 'opacity-90' : ''}`}>
                    <MyMatchupHero
                        league={league}
                        week={selectedWeek}
                        viewMatchups={viewMatchups}
                        rosters={rosters}
                        users={users}
                        players={players}
                        seasonMatchups={seasonMatchups}
                        selectedUserId={selectedUserId}
                    />
                    <LeaguePulse
                        league={league}
                        week={selectedWeek}
                        viewMatchups={viewMatchups}
                        rosters={rosters}
                        users={users}
                        players={players}
                    />
                    {/* Mobile-only: full lineup. Hidden ≥ lg per design composition. */}
                    <div className="lg:hidden">
                        <LineupToday
                            league={league}
                            week={selectedWeek}
                            roster={myRoster}
                            players={players}
                            viewMatchups={viewMatchups}
                            slotLabels={league?.roster_positions || []}
                        />
                    </div>
                    <Insights
                        leagueId={league?.league_id}
                        userId={selectedUserId}
                        week={selectedWeek}
                    />
                </div>

                {/* RIGHT rail: 4 stats → Standings → Roster News */}
                <div className="flex flex-col gap-4 min-w-0">
                    <QuickStats4
                        rosters={rosters}
                        users={users}
                        selectedUserId={selectedUserId}
                        league={league}
                        currentWeek={selectedWeek}
                        seasonMatchups={seasonMatchups}
                        state={state}
                    />
                    <StandingsStrip
                        league={league}
                        rosters={rosters}
                        users={users}
                        seasonMatchups={seasonMatchups}
                        currentUserId={selectedUserId}
                    />
                    <RosterNews roster={myRoster} players={players} />
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
