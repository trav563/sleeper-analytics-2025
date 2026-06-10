
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchNFLState,
    fetchLeagueUsers,
    fetchLeagueRosters,
    fetchLeagueMatchups,
    fetchNFLPlayers,
    fetchLeague,
    fetchTradedPicks
} from '../../../utils/sleeper';

export function useLeagueData(leagueId) {
    const queryClient = useQueryClient();

    // 1. NFL State (Needed for Matchups Week)
    const { data: state, isLoading: loadingState, error: errorState } = useQuery({
        queryKey: ['nflState'],
        queryFn: fetchNFLState,
        staleTime: 60 * 60 * 1000, // 1 hour (State doesn't change often)
    });


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

    let displayWeek = state?.display_week || state?.week || 1;
    if (league && league.status === 'complete') {
        // If league is from a past season, use week 17 as the default for fetching final data
        displayWeek = league.settings?.playoff_week_start ? league.settings.playoff_week_start + 2 : 17;
    }

    // 4. Matchups (Dynamic Cache)
    const isLiveWeek = true;
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

    // Refresh function — invalidates all league-related queries to force refetch
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['nflState'] });
        queryClient.invalidateQueries({ queryKey: ['nflPlayers'] });
        queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['leagueUsers', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['leagueRosters', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['tradedPicks', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['leagueMatchups', leagueId, displayWeek] });
    };

    return {
        state,
        users,
        rosters,
        matchups,
        players,
        league,
        tradedPicks,
        loading,
        error: error ? { message: 'Failed to load data' } : null,
        refresh
    };
}

