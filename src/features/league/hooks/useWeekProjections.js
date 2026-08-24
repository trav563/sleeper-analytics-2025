import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWeekProjections } from '../../../utils/sleeper';
import { projectedPoints } from '../../../utils/scoring';

/**
 * Weekly projections scored with the league's own scoring settings.
 *
 * Returns { projections, projFor, loading, hasProjections } where projFor(pid)
 * gives that player's projected points for the week (0 when unknown).
 */
export function useWeekProjections(season, week, scoringSettings) {
    const { data, isLoading } = useQuery({
        queryKey: ['weekProjections', season, week],
        queryFn: () => fetchWeekProjections(season, week),
        enabled: !!season && !!week,
        // Projections drift during the week and freeze once it's played.
        staleTime: 6 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 1,
    });

    const projections = useMemo(() => {
        if (!data) return {};
        const out = {};
        for (const [pid, stats] of Object.entries(data)) {
            const pts = projectedPoints(stats, scoringSettings);
            if (pts) out[pid] = pts;
        }
        return out;
    }, [data, scoringSettings]);

    const projFor = useMemo(
        () => (pid) => projections[pid] ?? 0,
        [projections]
    );

    return {
        projections,
        projFor,
        loading: isLoading,
        hasProjections: Object.keys(projections).length > 0,
    };
}
