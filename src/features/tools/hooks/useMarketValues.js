import { useQuery } from '@tanstack/react-query';
import { fetchValuationSnapshot } from '../../../utils/fantasyCalc';
import { valuationSettings } from '../../../utils/valuation';

export function useMarketValues(league, teamCount) {
    const settings = valuationSettings(league, teamCount);
    const query = useQuery({
        queryKey: ['marketValues', settings],
        queryFn: () => fetchValuationSnapshot(settings),
        enabled: !!league,
        staleTime: 60 * 60 * 1000,
    });
    return { ...query, data: query.data?.values, snapshot: query.data, settings };
}
