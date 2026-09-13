import { useQueries } from '@tanstack/react-query';
import { fetchSleeper } from '../../../utils/sleeper';
import { playerGameLogs } from '../../../utils/playerParticipation';

export function useCompletedPlayerStats(season, completedWeek, scoringSettings) {
    const weeks = season ? Array.from({ length: completedWeek || 0 }, (_, i) => i + 1) : [];
    return useQueries({
        queries: weeks.map(week => ({
            queryKey: ['playerWeekStats', season, week],
            queryFn: () => fetchSleeper(`/stats/nfl/regular/${season}/${week}`),
            staleTime: 60 * 60 * 1000,
        })),
        combine: results => ({
            logs: playerGameLogs(Object.fromEntries(results.map((r, i) => [weeks[i], r.data])), scoringSettings),
            loading: results.some(r => r.isLoading), error: results.some(r => r.isError),
        }),
    });
}
