import { useState, useEffect, useMemo } from 'react';
import { fetchSeasonStats } from '../../../utils/sleeper';

export function useCareerStats(startYear, endYear) {
    const [rawStats, setRawStats] = useState({}); // season -> stats
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadStats() {
            if (!startYear || !endYear) return;
            setLoading(true);

            const years = [];
            for (let y = parseInt(startYear); y <= parseInt(endYear); y++) {
                years.push(y.toString());
            }

            const newStats = {};
            try {
                await Promise.all(years.map(async (year) => {
                    // Check if we already have it (caching could be improved here)
                    const data = await fetchSeasonStats(year);
                    newStats[year] = data;
                }));
                setRawStats(newStats);
            } catch (err) {
                console.error("Failed to fetch career stats", err);
            } finally {
                setLoading(false);
            }
        }

        loadStats();
    }, [startYear, endYear]);

    // Aggregate Stats
    const careerStats = useMemo(() => {
        const aggregated = {}; // playerId -> { totalPoints, gamesPlayed, seasons: [] }

        Object.entries(rawStats).forEach(([season, stats]) => {
            if (!stats) return;
            Object.entries(stats).forEach(([playerId, playerStats]) => {
                if (!aggregated[playerId]) {
                    aggregated[playerId] = { totalPoints: 0, gamesPlayed: 0, seasons: [] };
                }
                // Sleeper stats object structure: { pts_ppr: 123, gp: 10, ... }
                // Assuming PPR for now, could be configurable
                const points = playerStats.pts_ppr || 0;
                const gp = playerStats.gp || 0;

                aggregated[playerId].totalPoints += points;
                aggregated[playerId].gamesPlayed += gp;
                aggregated[playerId].seasons.push(season);
            });
        });

        return aggregated;
    }, [rawStats]);

    return { careerStats, loading };
}
