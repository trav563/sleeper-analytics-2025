/**
 * Calculates the projected score for a lineup based on historical averages.
 * 
 * @param {Array} starters - Array of player IDs in the starting lineup.
 * @param {Object} seasonMatchups - Object containing matchups for previous weeks.
 * @param {Object} players - Object containing player data.
 * @returns {number} - The sum of "True Averages" for all starters.
 */
export function calculateProjectedScore(starters, seasonMatchups, players) {
    if (!starters || !seasonMatchups || !players) return 0;

    let totalProjection = 0;

    starters.forEach(playerId => {
        // Skip empty slots (0)
        if (playerId === '0' || !playerId) return;

        let totalPoints = 0;
        let gamesPlayed = 0;

        // Iterate through all available weeks in seasonMatchups
        Object.values(seasonMatchups).forEach(weekData => {
            // weekData is an array of matchups for that week
            if (!Array.isArray(weekData)) return;

            // Find the matchup containing this player
            // We can iterate through all matchups to find the player's points
            weekData.forEach(matchup => {
                if (matchup.players_points && matchup.players_points[playerId] !== undefined) {
                    const points = matchup.players_points[playerId];
                    // Exclude 0.0 points (absences)
                    if (points > 0) {
                        totalPoints += points;
                        gamesPlayed += 1;
                    }
                }
            });
        });

        // Calculate True Average
        const average = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;
        totalProjection += average;
    });

    return parseFloat(totalProjection.toFixed(2));
}
