import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useLeagueView } from '../hooks/useLeagueView';
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
    const { users, rosters, matchups: currentWeekMatchups, players, state, currentWeek, loading, error, user, league } = useOutletContext();
    const currentNFLWeek = currentWeek || 1;
    const { roster: myRoster, week: selectedWeek, selectRoster, selectWeek: setSelectedWeek } = useLeagueView(league?.league_id, rosters, user, currentNFLWeek);
    const selectedUserId = myRoster?.owner_id;
    const isHistoricalSeason = league?.season && state?.season && Number(league.season) < Number(state.season);
    const { data: selectedMatchups, isLoading: loadingMatchups, error: matchupError, refetch: retryMatchups } = useQuery({
        queryKey: ['leagueMatchups', league?.league_id, selectedWeek],
        queryFn: () => fetchLeagueMatchups(league.league_id, selectedWeek),
        enabled: !!league?.league_id && selectedWeek !== currentNFLWeek,
        staleTime: 60000,
    });
    const viewMatchups = selectedWeek === currentNFLWeek ? currentWeekMatchups || [] : selectedMatchups || [];
    const { seasonMatchups, completedWeek, loading: recordsLoading, error: recordsError } = useSeasonMatchups(league?.league_id, selectedWeek);
    const waitingForMatchups = selectedWeek !== currentNFLWeek && loadingMatchups;

    if (loading) {
        return (
            <div className="p-8 text-center font-mono text-xs uppercase tracking-wider text-text-mute">
                Loading dashboard…
            </div>
        );
    }
    if (error) {
        return (
            <div className="p-8 text-center font-mono text-xs uppercase tracking-wider text-bad">
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
                    <h1 className="font-display text-2xl md:text-3xl font-bold tracking-snug text-text">
                        League Dashboard
                    </h1>
                </div>
                <div className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] md:flex gap-2">
                    <label className="min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-2 bg-bg-2 px-2.5 py-1 rounded-md border border-line focus-within:ring-1 focus-within:ring-signal focus-within:border-signal">
                        <span className="font-mono text-xs uppercase tracking-wider text-text-mute">Week</span>
                        <select
                            className="min-w-0 min-h-11 w-full md:w-auto bg-transparent text-sm font-semibold text-text border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pr-6 tnum"
                            aria-label="Select week"
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                        >
                            {weekOptions.map((w) => (
                                <option key={w} value={w}>
                                    {w}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-2 bg-bg-2 px-2.5 py-1 rounded-md border border-line focus-within:ring-1 focus-within:ring-signal focus-within:border-signal">
                        <span className="font-mono text-xs uppercase tracking-wider text-text-mute">View as</span>
                        <select
                            className="min-w-0 min-h-11 w-full md:w-auto bg-transparent text-sm font-semibold text-text border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pr-6"
                            aria-label="View as team"
                            value={myRoster?.roster_id || ""}
                            onChange={(e) => selectRoster(e.target.value)}
                        >
                            {rosters?.map((r) => (
                                <option key={r.roster_id} value={r.roster_id}>
                                    {displayTeamName(users?.find(u => u.user_id === r.owner_id)) || `Team ${r.roster_id}`}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
                <div className="min-w-0">
                    {waitingForMatchups ? <div role="status" className="rounded-xl border border-line bg-bg-1 p-6 min-h-64 flex items-center justify-center text-text-dim">Loading Week {selectedWeek} matchup…</div>
                    : matchupError && selectedWeek !== currentNFLWeek ? <div role="alert" className="rounded-xl border border-line bg-bg-1 p-6"><p>Could not load Week {selectedWeek}.</p><button type="button" className="min-h-11 text-signal" onClick={() => retryMatchups()}>Try again</button></div>
                    : <MyMatchupHero league={league} week={selectedWeek} viewMatchups={viewMatchups}
                        rosters={rosters} users={users} players={players} seasonMatchups={seasonMatchups}
                        selectedUserId={selectedUserId} selectedRosterId={myRoster?.roster_id}
                        ownTeam={!!user?.user_id && (myRoster?.owner_id === user.user_id || myRoster?.co_owners?.includes(user.user_id))}
                        completedWeek={completedWeek} recordsLoading={recordsLoading} recordsError={recordsError} />}
                </div>
                <QuickStats4 rosters={rosters} users={users} selectedUserId={selectedUserId}
                    league={league} currentWeek={selectedWeek} seasonMatchups={seasonMatchups} state={state}
                    recordsLoading={recordsLoading} recordsError={recordsError} />
                <div className="min-w-0 space-y-4">
                    {!waitingForMatchups && !matchupError && <>
                        <div className="lg:hidden">
                            <LineupToday league={league} week={selectedWeek} roster={myRoster} players={players}
                                viewMatchups={viewMatchups} slotLabels={league?.roster_positions || []}
                                allowRosterFallback={!isHistoricalSeason && selectedWeek >= currentNFLWeek} />
                        </div>
                        <DashboardDisclosure title="League matchups">
                            <LeaguePulse league={league} week={selectedWeek} viewMatchups={viewMatchups}
                                rosters={rosters} users={users} players={players} completedWeek={completedWeek} />
                        </DashboardDisclosure>
                    </>}
                    {!isHistoricalSeason && !isTimeTraveling && <DashboardDisclosure title="AI team analysis">
                        <Insights leagueId={league?.league_id} userId={selectedUserId} week={selectedWeek} />
                    </DashboardDisclosure>}
                </div>
                <div className="min-w-0 space-y-4">
                    <StandingsStrip league={league} rosters={rosters} users={users} seasonMatchups={seasonMatchups}
                        currentUserId={selectedUserId} loading={recordsLoading} error={recordsError} />
                    {!isHistoricalSeason && <RosterNews roster={myRoster} players={players} />}
                </div>
            </div>
        </div>
    );
};

function DashboardDisclosure({ title, children }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    return <section>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
            className="lg:hidden min-h-12 w-full flex justify-between items-center border-b border-line py-3 text-sm font-semibold">
            {title}<span className="text-text-dim text-xs">{open ? 'Hide' : 'Show'}</span>
        </button>
        <div id={id} className={open ? 'pt-3 lg:pt-0' : 'hidden lg:block'}>{children}</div>
    </section>;
}

export default DashboardPage;
