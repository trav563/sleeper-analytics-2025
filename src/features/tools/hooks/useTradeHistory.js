import { useQuery } from '@tanstack/react-query';
import { fetchLeagueTransactions } from '../../../utils/sleeper';

/**
 * All completed trades for a league's season, newest first.
 * Sleeper serves transactions per week (round); empty weeks return [].
 * Cached aggressively — past trades are immutable.
 */
export function useTradeHistory(leagueId) {
    const { data: trades, isLoading } = useQuery({
        queryKey: ['tradeHistory', leagueId],
        queryFn: async () => {
            const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
            const results = await Promise.all(
                weeks.map(w => fetchLeagueTransactions(leagueId, w).catch(() => []))
            );
            const seen = new Set();
            return results
                .flat()
                .filter(t => t?.type === 'trade' && t.status === 'complete')
                .filter(t => {
                    if (seen.has(t.transaction_id)) return false;
                    seen.add(t.transaction_id);
                    return true;
                })
                .sort((a, b) => (b.created || 0) - (a.created || 0));
        },
        enabled: !!leagueId,
        staleTime: 60 * 60 * 1000,
    });

    return { trades: trades || [], loading: isLoading };
}
