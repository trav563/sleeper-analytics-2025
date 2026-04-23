import { useQuery } from '@tanstack/react-query';
import { getGameLiveDetails } from '../../../services/nflSchedule';

/**
 * Polls ESPN scoreboard every 60s while the window is focused. Returns
 *   { [teamAbbr]: { period, displayClock, score, statusName } }
 * for the given NFL week.
 */
export const useGameLiveDetails = (week) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['gameLiveDetails', week],
        queryFn: () => getGameLiveDetails(week),
        enabled: !!week,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        staleTime: 30_000,
    });

    return {
        details: data || {},
        isLoading,
        error,
    };
};

export default useGameLiveDetails;
