import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTrendingPlayers } from '../../../utils/sleeper';

/**
 * Sleeper "trending add" players for the past 24 hours. Returns an O(1)
 * lookup keyed by Sleeper player_id so list components can flag rows
 * with a "🔥 Hot" badge during pre-draft and live mode.
 *
 *   { idMap: { [player_id]: { rank, count } }, isLoading }
 */
export function useTrendingAdds() {
    const { data, isLoading } = useQuery({
        queryKey: ['trendingAdds'],
        queryFn: () => fetchTrendingPlayers('add', 24, 100),
        staleTime: 15 * 60 * 1000, // 15 min
    });

    const idMap = useMemo(() => {
        const out = {};
        (data || []).forEach((entry, idx) => {
            if (entry?.player_id) {
                out[entry.player_id] = { rank: idx + 1, count: entry.count };
            }
        });
        return out;
    }, [data]);

    return { idMap, isLoading };
}
