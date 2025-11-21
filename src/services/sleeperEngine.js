import { fetchLeague, fetchLeagueRosters } from '../utils/sleeper';

/**
 * Recursively fetches the history of a league by following the previous_league_id chain.
 * 
 * @param {string} currentLeagueId - The ID of the league to start fetching from.
 * @param {string} userId - The ID of the user to find their specific roster.
 * @returns {Promise<Array>} - An array of league objects sorted by season (descending).
 */
export const fetchLeagueHistory = async (currentLeagueId, userId) => {
    const history = [];

    const fetchRecursive = async (leagueId) => {
        if (!leagueId) return;

        try {
            // 1. Fetch league details
            const league = await fetchLeague(leagueId);
            if (!league) return;

            // 2. Fetch rosters
            const rosters = await fetchLeagueRosters(leagueId);

            // 3. Map rosters by owner_id for easy access
            const rostersByOwnerId = {};
            let userRoster = null;

            if (rosters) {
                rosters.forEach(r => {
                    if (r.owner_id) {
                        rostersByOwnerId[r.owner_id] = r;
                    }
                    if (r.owner_id === userId) {
                        userRoster = r;
                    }
                });
            }

            // 4. Store relevant data
            history.push({
                season: league.season,
                league_id: league.league_id,
                name: league.name,
                roster: userRoster,
                rosters: rostersByOwnerId,
                draft_id: league.draft_id,
                previous_league_id: league.previous_league_id
            });

            // 5. Recursive call if previous league exists
            if (league.previous_league_id) {
                await fetchRecursive(league.previous_league_id);
            }

        } catch (error) {
            console.error(`Error fetching history for league ${leagueId}:`, error);
        }
    };

    await fetchRecursive(currentLeagueId);

    // Sort by season descending (newest first)
    return history.sort((a, b) => b.season - a.season);
};
