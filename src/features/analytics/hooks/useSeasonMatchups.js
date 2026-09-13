import { lastCompletedWeek } from '../../../utils/seasonState';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchLeagueMatchups, fetchLeague, fetchNFLState } from '../../../utils/sleeper';

export function useSeasonMatchups(leagueId, requestedWeek, { includeIncomplete = false } = {}) {
    const { data: league, error: leagueError } = useQuery({ queryKey: ['league', leagueId], queryFn: () => fetchLeague(leagueId), enabled: !!leagueId, staleTime: 3600000 });
    const { data: state, error: stateError } = useQuery({ queryKey: ['nflState'], queryFn: fetchNFLState, staleTime: 60000 });
    const completedWeek = lastCompletedWeek(league, state);
    const currentWeek = includeIncomplete ? requestedWeek : Math.min(requestedWeek || 0, completedWeek);
    const enabled = !!leagueId && !!currentWeek && currentWeek >= 1;
    const weeks = enabled ? Array.from({ length: currentWeek }, (_, i) => i + 1) : [];

    // One query per week, keyed the same as useLeagueData's matchups query so
    // both hooks (and every component using this one) share a single cache
    // entry per week instead of refetching the whole season on mount.
    return useQueries({
        queries: weeks.map((week) => {
            const isCurrent = week === currentWeek;
            return {
                queryKey: ['leagueMatchups', leagueId, week],
                // fresh=true bypasses the CDN edge cache for the live week only
                queryFn: () => fetchLeagueMatchups(leagueId, week, isCurrent),
                staleTime: isCurrent ? 60 * 1000 : 60 * 60 * 1000, // past weeks are immutable
                gcTime: 24 * 60 * 60 * 1000,
            };
        }),
        combine: (results) => {
            const seasonMatchups = {};
            results.forEach((r, i) => {
                if (r.data?.length) seasonMatchups[weeks[i]] = r.data;
            });
            return {
                seasonMatchups, completedWeek,
                loading: (!league && !leagueError) || (!state && !stateError) || results.some((r) => r.isLoading),
                error: leagueError || stateError || results.some((r) => r.error) ? 'Failed to load season matchups' : null,
            };
        },
    });
}
