import { useQueries } from '@tanstack/react-query';
import { fetchLeagueMatchups } from '../../../utils/sleeper';

export function useSeasonMatchups(leagueId, currentWeek) {
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
                staleTime: isCurrent ? 60 * 1000 : Infinity, // past weeks are immutable
                gcTime: 24 * 60 * 60 * 1000,
            };
        }),
        combine: (results) => {
            const seasonMatchups = {};
            results.forEach((r, i) => {
                if (r.data) seasonMatchups[weeks[i]] = r.data;
            });
            return {
                seasonMatchups,
                loading: results.some((r) => r.isLoading),
                error: results.some((r) => r.error) ? 'Failed to load season matchups' : null,
            };
        },
    });
}
