import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchSeasonStats, fetchNFLState } from '../../../utils/sleeper';
import { useCompletedPlayerStats } from './useCompletedPlayerStats';
import { lastCompletedWeek } from '../../../utils/seasonState';
import { projectedPoints } from '../../../utils/scoring';

/** Completed production only; React Query keys isolate rapid season changes. */
export function useCareerStats(startYear, endYear, scoringSettings) {
    const { data: state } = useQuery({ queryKey: ['nflState'], queryFn: fetchNFLState, staleTime: 60000 });
    const currentSeason = Number(state?.season);
    const includeCurrent = Number(startYear) <= currentSeason && Number(endYear) >= currentSeason;
    const current = useCompletedPlayerStats(includeCurrent ? state?.season : null, lastCompletedWeek({ season: state?.season }, state), scoringSettings);
    const years = [];
    if (state && startYear && endYear) for (let y = Number(startYear); y <= Math.min(Number(endYear), currentSeason - 1); y++) years.push(y);
    const historical = useQueries({ queries: years.map(y => ({ queryKey: ['seasonStats', String(y)], queryFn: () => fetchSeasonStats(String(y)), staleTime: 3600000 })),
        combine: results => ({ stats: results.map((r,i) => [years[i],r.data]), loading: results.some(r => r.isLoading), error: results.some(r => r.isError) }) });
    const careerStats = useMemo(() => {
        const totals = {};
        for (const [season, stats] of historical.stats) for (const [id, line] of Object.entries(stats || {})) {
            const t = totals[id] ||= { totalPoints: 0, gamesPlayed: 0, seasons: [] };
            t.totalPoints += projectedPoints(line, scoringSettings); t.gamesPlayed += line.gp || 0; t.seasons.push(String(season));
        }
        if (includeCurrent) for (const [id, games] of Object.entries(current.logs)) {
            const t = totals[id] ||= { totalPoints: 0, gamesPlayed: 0, seasons: [] };
            t.totalPoints += games.reduce((sum,g) => sum+g.points,0); t.gamesPlayed += games.length; t.seasons.push(String(currentSeason));
        }
        return totals;
    }, [historical.stats, current.logs, currentSeason, includeCurrent, scoringSettings]);
    return { careerStats, loading: !state || historical.loading || current.loading, error: historical.error || current.error };
}
