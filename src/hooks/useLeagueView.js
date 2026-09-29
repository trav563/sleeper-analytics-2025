import { useSleeper } from '../context/SleeperContext';
import { useCallback } from 'react';

export const validWeek = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 18;

export function resolveViewedRoster(rosters = [], selectedId, userId) {
    return rosters.find(r => r.roster_id === Number(selectedId))
        || (userId && rosters.find(r => r.owner_id === userId || r.co_owners?.includes(userId)))
        || rosters[0] || null;
}

/** Shared, league-scoped viewing context; reset a saved week when the NFL week rolls over. */
export function useLeagueView(leagueId, rosters, user, currentWeek = 1) {
    const { viewedTeams, selectViewedTeam, viewedWeeks, selectViewedWeek } = useSleeper();
    const roster = resolveViewedRoster(rosters, viewedTeams[leagueId], user?.user_id);
    const savedWeek = viewedWeeks[leagueId];
    const week = savedWeek?.anchor === currentWeek && validWeek(savedWeek.week) ? savedWeek.week : currentWeek;
    const selectRoster = useCallback(id => selectViewedTeam(leagueId, Number(id)), [leagueId, selectViewedTeam]);
    const selectWeek = useCallback(next => {
        if (validWeek(next)) selectViewedWeek(leagueId, Number(next), currentWeek);
    }, [leagueId, currentWeek, selectViewedWeek]);
    return {
        roster, week, selectRoster, selectWeek,
    };
}
