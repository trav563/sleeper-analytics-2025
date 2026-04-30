import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketValues } from '../../../utils/fantasyCalc';

/**
 * Cached FantasyCalc dynasty values keyed by Sleeper player ID.
 * Returns {} if FantasyCalc is unreachable so callers can degrade gracefully.
 *
 * Optionally accepts `players` for a one-time diagnostic logging the match
 * count. Useful when triaging "why are values blank?" — remove after triage.
 */
export function useMarketValues({ league, players }) {
    const isSuperflex = (league?.roster_positions || []).includes('SUPER_FLEX');
    const numTeams = league?.settings?.num_teams || 12;
    const ppr = league?.scoring_settings?.rec ?? 0.5;

    const { data } = useQuery({
        queryKey: ['fantasyCalc', { isSuperflex, numTeams, ppr }],
        queryFn: () => fetchMarketValues(isSuperflex, numTeams, ppr),
        staleTime: 4 * 60 * 60 * 1000,
        enabled: !!league,
    });

    useEffect(() => {
        if (!data || !players) return;
        const ids = Object.keys(players);
        const matched = ids.filter((id) => data[id] != null).length;
        // eslint-disable-next-line no-console
        console.log(`[draft-assistant] FantasyCalc: ${Object.keys(data).length} entries, ${matched}/${ids.length} matched in player pool`);
    }, [data, players]);

    return data || {};
}
