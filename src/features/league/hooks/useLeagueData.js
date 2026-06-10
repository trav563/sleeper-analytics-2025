
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();

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
        // fresh=true bypasses the CDN edge cache so live scores aren't stale
        queryFn: () => fetchLeagueMatchups(leagueId, displayWeek, true),
        enabled: !!leagueId && !!displayWeek,
        staleTime: matchupsStaleTime,
    });

    // Aggregate Loading & Error States.
    // loadingCore excludes the ~5MB players blob so pages can render league
    // data while it downloads; `loading` keeps the old all-in gate for
    // existing consumers.
    const loadingCore = loadingState || loadingLeague || loadingUsers || loadingRosters || loadingPicks || loadingMatchups;
    const loading = loadingCore || loadingPlayers;

    const error = errorState || errorPlayers || errorLeague || errorUsers || errorRosters || errorPicks || errorMatchups;

    // Invalidate this league's queries (and shared NFL state) to force a
    // refetch. The players blob is excluded — it changes daily at most.
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['nflState'] });
        queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['leagueUsers', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['leagueRosters', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['tradedPicks', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['leagueDrafts', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['leagueMatchups', leagueId] });
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
        loadingCore,
        loadingPlayers,
        error: error ? { message: 'Failed to load data' } : null, // Simplify error object
        refresh
    };
}
