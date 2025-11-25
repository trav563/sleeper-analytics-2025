import { useState, useEffect } from 'react';
import { fetchLeague } from '../../../utils/sleeper';

export function useLeagueHistory(currentLeagueId) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadHistory() {
            if (!currentLeagueId) return;
            setLoading(true);

            const leagues = [];
            let nextId = currentLeagueId;
            let safety = 0;

            try {
                while (nextId && safety < 10) { // Safety limit of 10 years
                    const league = await fetchLeague(nextId);
                    if (!league) break;

                    leagues.push({
                        season: league.season,
                        league_id: league.league_id,
                        draft_id: league.draft_id,
                        name: league.name
                    });

                    nextId = league.previous_league_id;
                    safety++;
                }
                setHistory(leagues);
            } catch (err) {
                console.error("Failed to load league history", err);
            } finally {
                setLoading(false);
            }
        }

        loadHistory();
    }, [currentLeagueId]);

    return { history, loading };
}
