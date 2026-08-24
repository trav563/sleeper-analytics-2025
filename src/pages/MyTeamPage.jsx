import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import RosterDetail from '../features/league/components/RosterDetail';
import LineupOptimizer from '../features/team/components/LineupOptimizer';
import RosterConstruction from '../features/team/components/RosterConstruction';
import AssetLedger from '../features/team/components/AssetLedger';
import SeasonOutlook from '../features/team/components/SeasonOutlook';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';
import { usePowerRankings } from '../features/analytics/hooks/usePowerRankings';
import { usePlayoffOdds } from '../features/dashboard/hooks/usePlayoffOdds';
import { useWeekProjections } from '../features/league/hooks/useWeekProjections';
import { fetchMarketValues } from '../utils/fantasyCalc';
import { fetchLeagueRosters } from '../utils/sleeper';

/**
 * The team page. Reached as /my-team (your own roster, from the nav) or
 * /team/:rosterId (anyone else's). One implementation either way — the roster
 * view plus the analysis sections.
 */
const MyTeamPage = () => {
    const { rosterId } = useParams();
    const ctx = useOutletContext();
    const {
        league, rosters, users, players, state, user,
        matchups: currentWeekMatchups, currentWeek, tradedPicks,
    } = ctx || {};

    // /team/:rosterId targets a specific roster; /my-team resolves the signed-in user's.
    const roster = useMemo(() => {
        if (!rosters?.length) return null;
        if (rosterId) return rosters.find((r) => r.roster_id === Number(rosterId)) || null;
        if (!user?.user_id) return null;
        return rosters.find(
            (r) => r.owner_id === user.user_id || (r.co_owners || []).includes(user.user_id)
        ) || null;
    }, [rosters, rosterId, user]);

    const isSuperflex = league?.roster_positions?.includes('SUPER_FLEX');
    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentWeek);
    // Whole regular season (Sleeper posts matchup pairings in advance), so the
    // outlook can see the schedule beyond the current week. Same query keys as
    // above, so React Query dedupes the overlap.
    const playoffStart = league?.settings?.playoff_week_start || 15;
    const { seasonMatchups: fullSchedule } = useSeasonMatchups(league?.league_id, playoffStart - 1);
    const { projFor } = useWeekProjections(league?.season, currentWeek, league?.scoring_settings);
    const { rankings, ranked } = usePowerRankings(seasonMatchups, rosters, users);

    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', league?.league_id],
        queryFn: () => fetchMarketValues(isSuperflex, rosters?.length || 12, 0.5),
        staleTime: 60 * 60 * 1000,
        enabled: !!league,
    });

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
    if (!rosterId && rosters?.length && !user?.user_id) {
        return <Navigate to="/" replace />;
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
