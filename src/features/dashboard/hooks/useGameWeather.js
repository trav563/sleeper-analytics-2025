import { useQuery } from '@tanstack/react-query';
import { getGameWeather } from '../../../services/nflSchedule';

/**
 * Tiny React Query wrapper over getGameWeather(week). Returns { [abbr]: {...} }.
 * Cached for 10 min — weather doesn't change minute-to-minute.
 */
export const useGameWeather = (week) => {
    const { data, isLoading } = useQuery({
        queryKey: ['gameWeather', week],
        queryFn: () => getGameWeather(week),
        enabled: !!week,
        staleTime: 10 * 60 * 1000,
    });
    return { weather: data || {}, isLoading };
};

export default useGameWeather;
