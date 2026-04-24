
import { useQuery } from '@tanstack/react-query';
import {
    fetchNFLState,
    fetchLeagueUsers,
    fetchLeagueRosters,
    fetchLeagueMatchups,
    fetchNFLPlayers,
    fetchLeague,
    fetchTradedPicks,
    fetchLeagueDrafts
} from '../../../utils/sleeper';

export function useLeagueData(leagueId) {
    // 1. NFL State (Needed for Matchups Week)
    const { data: state, isLoading: loadingState, error: errorState } = useQuery({
        queryKey: ['nflState'],
        queryFn: fetchNFLState,
        staleTime: 60 * 60 * 1000, // 1 hour (State doesn't change often)
    });

    const displayWeek = state?.display_week || state?.week || 1;

    // 2. Players Master List (Cache: 24h)
    const { data: players, isLoading: loadingPlayers, error: errorPlayers } = useQuery({
        queryKey: ['nflPlayers'],
        queryFn: fetchNFLPlayers,
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
        gcTime: 24 * 60 * 60 * 1000, // Keep in memory
    });

    // 3. League Data Group (Cache: 1h)
    const { data: league, isLoading: loadingLeague, error: errorLeague } = useQuery({
        queryKey: ['league', leagueId],
        queryFn: () => fetchLeague(leagueId),
        enabled: !!leagueId,
        staleTime: 60 * 60 * 1000, // 1 hour
    });

    const { data: users, isLoading: loadingUsers, error: errorUsers } = useQuery({
        queryKey: ['leagueUsers', leagueId],
        queryFn: () => fetchLeagueUsers(leagueId),
        enabled: !!leagueId,
        staleTime: 60 * 60 * 1000, // 1 hour
    });

    const { data: rosters, isLoading: loadingRosters, error: errorRosters } = useQuery({
        queryKey: ['leagueRosters', leagueId],
        queryFn: () => fetchLeagueRosters(leagueId),
        enabled: !!leagueId,
        staleTime: 60 * 60 * 1000, // 1 hour
    });

    const { data: tradedPicks, isLoading: loadingPicks, error: errorPicks } = useQuery({
        queryKey: ['tradedPicks', leagueId],
        queryFn: () => fetchTradedPicks(leagueId),
        enabled: !!leagueId,
        staleTime: 60 * 60 * 1000, // 1 hour
    });

    const { data: drafts } = useQuery({
        queryKey: ['leagueDrafts', leagueId],
        queryFn: () => fetchLeagueDrafts(leagueId),
        enabled: !!leagueId,
        staleTime: 60 * 60 * 1000, // 1 hour — drafts rarely change
    });

    // 4. Matchups (Dynamic Cache)
    // If it's the current live week, cache for 60s. If past week, cache for 24h.
    // Note: state.week is usually the live week. display_week might be same.
    // For simplicity, if we are fetching the week returned by fetchNFLState, assume it's live/active.
    const isLiveWeek = true; // We are fetching the 'current' week as defined by Sleeper State
    const matchupsStaleTime = isLiveWeek ? 60 * 1000 : 24 * 60 * 60 * 1000;

    const { data: matchups, isLoading: loadingMatchups, error: errorMatchups } = useQuery({
        queryKey: ['leagueMatchups', leagueId, displayWeek],
        queryFn: () => fetchLeagueMatchups(leagueId, displayWeek),
        enabled: !!leagueId && !!displayWeek,
        staleTime: matchupsStaleTime,
    });

    // Aggregate Loading & Error States
    const loading = loadingState || loadingPlayers || loadingLeague || loadingUsers || loadingRosters || loadingPicks || loadingMatchups;

    const error = errorState || errorPlayers || errorLeague || errorUsers || errorRosters || errorPicks || errorMatchups;

    // Refresh function (Invalidates queries to force refetch)
    // Note: React Query handles refetching automatically based on staleTime. 
    // Manual refresh would use queryClient.invalidateQueries, but we need access to queryClient.
    // For now, we return a no-op or we could use useQueryClient to get the client.
    const refresh = () => {
        // Implementation would require queryClient
        // window.location.reload(); // Simple brute force for now if requested, or leave empty as auto-refresh handles it
    };

    return {
        state,
        users,
        rosters,
        matchups,
        players,
        league,
        tradedPicks,
        drafts,
        loading,
        error: error ? { message: 'Failed to load data' } : null, // Simplify error object
        refresh
    };
}
