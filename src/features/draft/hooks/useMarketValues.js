import { useQuery } from '@tanstack/react-query';
import { fetchMarketValues } from '../../../utils/fantasyCalc';

/**
 * Cached FantasyCalc dynasty values keyed by Sleeper player ID.
 * Returns {} if FantasyCalc is unreachable so callers can degrade gracefully.
 */
export function useMarketValues({ league }) {
    const isSuperflex = (league?.roster_positions || []).includes('SUPER_FLEX');
    const numTeams = league?.settings?.num_teams || 12;
    const ppr = league?.scoring_settings?.rec ?? 0.5;

    const { data } = useQuery({
        queryKey: ['fantasyCalc', { isSuperflex, numTeams, ppr }],
        queryFn: () => fetchMarketValues(isSuperflex, numTeams, ppr),
        staleTime: 4 * 60 * 60 * 1000,
        enabled: !!league,
    });

    return data || {};
}
