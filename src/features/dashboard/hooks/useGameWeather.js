import { useQuery } from '@tanstack/react-query';
import { getGameWeather } from '../../../services/nflSchedule';

/**
 * Tiny React Query wrapper over getGameWeather(week, season). Returns { [abbr]: {...} }.
 * Cached for 10 min — weather doesn't change minute-to-minute.
 */
export const useGameWeather = (week, season) => {
    const { data, isLoading } = useQuery({
        queryKey: ['gameWeather', season, week],
        queryFn: () => getGameWeather(week, season),
        enabled: !!week,
        staleTime: 10 * 60 * 1000,
    });
    return { weather: data || {}, isLoading };
};

export default useGameWeather;
