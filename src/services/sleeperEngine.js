import { fetchLeague, fetchLeagueRosters } from '../utils/sleeper';

// Hard stop for the previous_league_id walk. Sleeper dynasty chains are one
// league per season, so 15 covers any real league while bounding a bad chain.
const MAX_CHAIN_DEPTH = 15;

/**
 * Fetches the history of a league by following the previous_league_id chain.
 *
 * @param {string} currentLeagueId - The ID of the league to start fetching from.
 * @param {string} userId - The ID of the user to find their specific roster.
 * @returns {Promise<{chain: Array, truncated: boolean}>} - League objects sorted
 *   by season (descending). `truncated` is true when a mid-chain hop failed and
 *   the walk stopped early, so consumers can warn instead of silently computing
 *   over partial history. A failure on the *first* league throws.
 */
export const fetchLeagueHistory = async (currentLeagueId, userId) => {
    const history = [];
    const visited = new Set();
    let truncated = false;

    let leagueId = currentLeagueId;
    while (leagueId && !visited.has(leagueId) && visited.size < MAX_CHAIN_DEPTH) {
        visited.add(leagueId);
        try {
            const league = await fetchLeague(leagueId);
            if (!league) {
                if (history.length === 0) throw new Error(`League not found: ${leagueId}`);
                truncated = true;
                break;
            }

            const rosters = await fetchLeagueRosters(leagueId);

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

            history.push({
                season: league.season,
                league_id: league.league_id,
                name: league.name,
                roster: userRoster,
                rosters: rostersByOwnerId,
                draft_id: league.draft_id,
                // Needed to split regular season from postseason per season
                // instead of assuming a fixed week window.
                playoff_week_start: league.settings?.playoff_week_start,
                previous_league_id: league.previous_league_id
            });

            leagueId = league.previous_league_id;
        } catch (error) {
            // A dead first hop is a real error the caller must see; a dead
            // deeper hop yields a partial chain, flagged so it isn't silent.
            if (history.length === 0) throw error;
            console.warn(`League history truncated at league ${leagueId}:`, error);
            truncated = true;
            break;
        }
    }

    // Sort by season descending (newest first)
    return { chain: history.sort((a, b) => b.season - a.season), truncated };
};
