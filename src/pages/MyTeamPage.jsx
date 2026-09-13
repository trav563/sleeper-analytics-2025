import { useSleeper } from '../context/SleeperContext';
import { useMarketValues } from '../features/tools/hooks/useMarketValues';
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams, Link } from 'react-router-dom';

import RosterDetail from '../features/league/components/RosterDetail';
import LineupOptimizer from '../features/team/components/LineupOptimizer';
import RosterConstruction from '../features/team/components/RosterConstruction';
import AssetLedger from '../features/team/components/AssetLedger';
import SeasonOutlook from '../features/team/components/SeasonOutlook';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';
import { usePowerRankings } from '../features/analytics/hooks/usePowerRankings';
import { usePlayoffOdds } from '../features/dashboard/hooks/usePlayoffOdds';
import { useWeekProjections } from '../features/league/hooks/useWeekProjections';

import { fetchLeagueRosters } from '../utils/sleeper';

/**
 * The team page. Reached as /my-team (your own roster, from the nav) or
 * /team/:rosterId (anyone else's). One implementation either way — the roster
 * view plus the analysis sections.
 */
const MyTeamPage = () => {
    const { rosterId } = useParams();
    const [searchParams] = useSearchParams();
    const choosingTeam = !rosterId && searchParams.get('choose-team') === '1';
    const { viewedTeams, selectViewedTeam } = useSleeper();
    const ctx = useOutletContext();
    const {
        league, rosters, users, players, state, user,
        matchups: currentWeekMatchups, currentWeek, tradedPicks,
    } = ctx || {};

    useEffect(() => {
        if (rosterId && league?.league_id && rosters?.some(r => r.roster_id === Number(rosterId))) selectViewedTeam(league.league_id, Number(rosterId));
    }, [rosterId, league?.league_id, rosters, selectViewedTeam]);
    const viewedRosterId = viewedTeams[league?.league_id];
    // /team/:rosterId targets a specific roster; /my-team resolves the signed-in user's.
    const roster = useMemo(() => {
        if (!rosters?.length) return null;
        if (rosterId) return rosters.find((r) => r.roster_id === Number(rosterId)) || null;
        if (!user?.user_id) return rosters.find(r => r.roster_id === viewedRosterId) || null;
        return rosters.find(
            (r) => r.owner_id === user.user_id || (r.co_owners || []).includes(user.user_id)
        ) || null;
    }, [rosters, rosterId, user, viewedRosterId]);

    const isSuperflex = (league?.roster_positions || []).filter(p => p === 'QB' || p === 'SUPER_FLEX').length >= 2;
    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentWeek);
    // Whole regular season (Sleeper posts matchup pairings in advance), so the
    // outlook can see the schedule beyond the current week. Same query keys as
    // above, so React Query dedupes the overlap.
    const playoffStart = league?.settings?.playoff_week_start || 15;
    const { seasonMatchups: fullSchedule } = useSeasonMatchups(league?.league_id, playoffStart - 1, { includeIncomplete: true });
    const { projFor } = useWeekProjections(league?.season, currentWeek, league?.scoring_settings);
    const { rankings, ranked } = usePowerRankings(seasonMatchups, rosters, users);

    const { data: marketValues, snapshot: marketSnapshot } = useMarketValues(league, rosters?.length);

    const [prevSeasonRosters, setPrevSeasonRosters] = useState(null);
    useEffect(() => {
        if (!league?.previous_league_id) return;
        let cancelled = false;
        fetchLeagueRosters(league.previous_league_id)
            .then((data) => { if (!cancelled && data) setPrevSeasonRosters(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [league?.previous_league_id]);

    const { odds, isProjection } = usePlayoffOdds(
        league, rosters, currentWeek, marketValues, state?.season_type || 'regular', prevSeasonRosters
    );

    // Signed out with no explicit roster — nothing to show.
    if (rosters?.length && (choosingTeam || (!rosterId && !roster && !user?.user_id))) {
        return <section className="space-y-4"><h1 className="text-2xl font-bold">Choose a team</h1><p className="text-sm text-text-dim">Select a roster to view its lineup, players, and dynasty assets.</p><div className="grid sm:grid-cols-2 gap-3">{rosters.map(r => <Link key={r.roster_id} to={`/league/${league.league_id}/team/${r.roster_id}`} className="min-h-12 p-4 bg-bg-1 border border-line rounded-lg text-sm font-semibold">{users?.find(u => u.user_id === r.owner_id)?.metadata?.team_name || users?.find(u => u.user_id === r.owner_id)?.display_name || `Team ${r.roster_id}`}</Link>)}</div></section>;
    }

    if (rosters?.length && !roster) {
        return (
            <div className="text-center p-12 space-y-3 bg-bg-1 rounded-xl border border-line">
                <h3 className="font-display text-lg font-semibold text-text">No team found</h3>
                <p className="text-sm text-text-dim max-w-md mx-auto">
                    You don't appear to own a roster in this league. Pick a team from the Standings
                    to view it instead.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {!user?.user_id && <Link className="inline-flex items-center min-h-11 text-sm text-signal" to={`/league/${league.league_id}/my-team?choose-team=1`}>Change team</Link>}
            <RosterDetail
                league={league}
                rosters={rosters}
                users={users}
                players={players}
                state={state}
                roster={roster}
                currentWeekMatchups={currentWeekMatchups}
                seasonMatchups={seasonMatchups}
            />

            <LineupOptimizer
                league={league}
                roster={roster}
                players={players}
                week={currentWeek}
                projFor={projFor}
                isHistoricalSeason={Number(league?.season) < Number(state?.season)}
            />

            <SeasonOutlook
                league={league}
                roster={roster}
                users={users}
                rosters={rosters}
                odds={odds}
                isProjection={isProjection}
                rankings={rankings}
                ranked={ranked}
                fullSchedule={fullSchedule}
                currentWeek={currentWeek}
            />

            <div className="grid lg:grid-cols-2 gap-5">
                <RosterConstruction
                    roster={roster}
                    players={players}
                    marketValues={marketValues}
                />
                <AssetLedger
                    seasonMatchups={seasonMatchups}
                    marketSnapshot={marketSnapshot}
                    league={league}
                    rosters={rosters}
                    roster={roster}
                    players={players}
                    tradedPicks={tradedPicks}
                    marketValues={marketValues}
                    isSuperflex={isSuperflex}
                />
            </div>
        </div>
    );
};

export default MyTeamPage;
