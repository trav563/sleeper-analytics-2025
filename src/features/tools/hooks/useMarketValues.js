import { useQuery } from '@tanstack/react-query';
import { fetchValuationSnapshot } from '../../../utils/fantasyCalc';
import { valuationSettings } from '../../../utils/valuation';

/** `overrides` requests another format, e.g. `{ isDynasty: false }` for this-season values. */
export function useMarketValues(league, teamCount, overrides) {
    const settings = { ...valuationSettings(league, teamCount), ...overrides };
    const query = useQuery({
        queryKey: ['marketValues', settings],
        queryFn: () => fetchValuationSnapshot(settings),
        enabled: !!league,
        staleTime: 60 * 60 * 1000,
    });
    return { ...query, data: query.data?.values, snapshot: query.data, settings };
}
