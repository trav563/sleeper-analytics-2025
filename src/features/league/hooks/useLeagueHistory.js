import { useState, useEffect } from 'react';
import { fetchLeague } from '../../../utils/sleeper';

export function useLeagueHistory(currentLeagueId) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        async function loadHistory() {
            if (!currentLeagueId) return;
            // Reset so a league switch never shows the previous league's
            // seasons while the new walk is in flight.
            setHistory([]);
            setLoading(true);

            const leagues = [];
            const visited = new Set();
            let nextId = currentLeagueId;

            try {
                while (nextId && !visited.has(nextId) && visited.size < 10) { // Safety limit of 10 years
                    visited.add(nextId);
                    const league = await fetchLeague(nextId, { signal: controller.signal });
                    if (!league) break;

                    leagues.push({
                        season: league.season,
                        league_id: league.league_id,
                        draft_id: league.draft_id,
                        name: league.name
                    });

                    nextId = league.previous_league_id;
                }
                if (!controller.signal.aborted) setHistory(leagues);
            } catch (err) {
                if (!controller.signal.aborted) console.error("Failed to load league history", err);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        loadHistory();
        return () => controller.abort();
    }, [currentLeagueId]);

    return { history, loading };
}
