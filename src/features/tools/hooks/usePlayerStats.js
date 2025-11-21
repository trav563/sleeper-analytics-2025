import { useMemo } from 'react';

export function usePlayerStats(seasonMatchups) {
    const playerStats = useMemo(() => {
        if (!seasonMatchups) return {};

        const stats = {}; // playerId -> { totalPoints, gamesPlayed, avgPoints, positions: [] }

        Object.values(seasonMatchups).forEach(weekMatchups => {
            if (!weekMatchups) return;

            weekMatchups.forEach(matchup => {
                matchup.starters.forEach((playerId, index) => {
                    if (!playerId || playerId === "0") return;

                    const points = matchup.starters_points[index] || 0;

                    if (!stats[playerId]) {
                        stats[playerId] = {
                            totalPoints: 0,
                            gamesPlayed: 0,
                            avgPoints: 0
                        };
                    }

                    stats[playerId].totalPoints += points;
                    stats[playerId].gamesPlayed += 1;
                });
            });
        });

        // Calculate Averages
        Object.keys(stats).forEach(pid => {
            stats[pid].avgPoints = stats[pid].totalPoints / (stats[pid].gamesPlayed || 1);
        });

        return stats;
    }, [seasonMatchups]);

    return playerStats;
}
