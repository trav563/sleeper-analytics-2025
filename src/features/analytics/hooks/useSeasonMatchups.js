import { useState, useEffect } from 'react';
import { fetchLeagueMatchups } from '../../../utils/sleeper';

export function useSeasonMatchups(leagueId, currentWeek) {
    const [seasonMatchups, setSeasonMatchups] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchAllMatchups() {
            if (!leagueId || !currentWeek) return;

            setLoading(true);
            setError(null);

            try {
                const promises = [];
                // Fetch matchups for all weeks up to current week
                // Assuming currentWeek is 1-indexed. If currentWeek is 1, we fetch week 1.
                // If currentWeek is > 1, we fetch 1 to currentWeek.
                // Note: Sleeper API might return empty for future weeks, but we only want completed or in-progress.
                // Let's fetch 1 to currentWeek.
                for (let w = 1; w <= currentWeek; w++) {
                    promises.push(fetchLeagueMatchups(leagueId, w).then(data => ({ week: w, data })));
                }

                const results = await Promise.all(promises);
                const matchupsByWeek = {};
                results.forEach(({ week, data }) => {
                    matchupsByWeek[week] = data;
                });

                setSeasonMatchups(matchupsByWeek);
            } catch (err) {
                console.error("Failed to fetch season matchups:", err);
                setError("Failed to load season matchups");
            } finally {
                setLoading(false);
            }
        }

        fetchAllMatchups();
    }, [leagueId, currentWeek]);

    return { seasonMatchups, loading, error };
}
