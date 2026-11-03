import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clearLegacyProbabilityHistory } from '../../../lib/winProbabilityHistory';

const TRACK_STORAGE_PREFIX = 'league-win-tracked:';
const TRACK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SAMPLE_INTERVAL_MS = 5 * 60 * 1000;

function trackedRecently(leagueId) {
    try {
        return Date.now() - Number(localStorage.getItem(TRACK_STORAGE_PREFIX + leagueId)) < TRACK_INTERVAL_MS;
    } catch { return false; }
}

function markTracked(leagueId) {
    try { localStorage.setItem(TRACK_STORAGE_PREFIX + leagueId, String(Date.now())); } catch { /* Re-sends next visit. */ }
}

/** Tells the server this league is in use, so it keeps sampling it between visits. */
export function useTrackWinProbability(leagueId, enabled) {
    useEffect(() => {
        if (!leagueId || !enabled) return;
        clearLegacyProbabilityHistory();
        if (trackedRecently(leagueId)) return;
        fetch('/api/win-probability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leagueId: String(leagueId) }),
        }).then(response => { if (response.ok) markTracked(leagueId); }).catch(() => { /* Retried on the next visit. */ });
    }, [leagueId, enabled]);
}

/** A league week's recorded samples; the chart picks out its own matchup. */
export function useWinProbabilitySamples({ leagueId, season, week, live, enabled = true }) {
    return useQuery({
        queryKey: ['winProbabilitySamples', leagueId, season, week],
        queryFn: async () => {
            const params = new URLSearchParams({ leagueId, season, week });
            const response = await fetch(`/api/win-probability?${params}`);
            if (!response.ok) throw new Error('Win probability history unavailable');
            return (await response.json()).samples;
        },
        enabled: enabled && !!leagueId && !!season && !!week,
        staleTime: 60 * 1000,
        refetchInterval: live ? SAMPLE_INTERVAL_MS : false,
        refetchIntervalInBackground: false,
        retry: 1,
    });
}
