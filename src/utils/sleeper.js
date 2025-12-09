const BASE_URL = 'https://api.sleeper.app/v1';

/**
 * Generic fetcher for Sleeper API
 * @param {string} endpoint - The API endpoint to call (e.g., '/user/username')
 * @returns {Promise<any>} - The JSON response
 */
export const fetchSleeper = async (endpoint) => {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);

        if (!response.ok) {
            throw new Error(`Sleeper API Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching from Sleeper API:', error);
        throw error;
    }
};

/**
 * Fetch user by username
 * @param {string} username 
 */
export const fetchUser = async (username) => {
    return fetchSleeper(`/user/${username}`);
};

/**
 * Fetch all leagues for a user in a specific season
 * @param {string} userId 
 * @param {string} season - e.g., '2024'
 */
export const fetchUserLeagues = async (userId, season = '2025') => {
    return fetchSleeper(`/user/${userId}/leagues/nfl/${season}`);
};

/**
 * Fetch users in a league
 * @param {string} leagueId 
 */
export const fetchLeagueUsers = async (leagueId) => {
    const timestamp = Date.now();
    return fetchSleeper(`/league/${leagueId}/users?_=${timestamp}`);
};

/**
 * Fetch rosters in a league
 * @param {string} leagueId 
 */
export const fetchLeagueRosters = async (leagueId) => {
    const timestamp = Date.now();
    return fetchSleeper(`/league/${leagueId}/rosters?_=${timestamp}`);
};

/**
 * Fetch matchups for a specific week
 * @param {string} leagueId 
 * @param {number|string} week 
 */
export const fetchLeagueMatchups = async (leagueId, week) => {
    const timestamp = Date.now();
    return fetchSleeper(`/league/${leagueId}/matchups/${week}?_=${timestamp}`);
};

/**
 * Fetch current NFL state (week, season type, etc.)
 */
export const fetchNFLState = async () => {
    const timestamp = Date.now();
    return fetchSleeper(`/state/nfl?_=${timestamp}`);
};

/**
 * Fetch all NFL players (large payload, should be cached if possible)
 */
export const fetchNFLPlayers = async () => {
    const timestamp = Date.now();
    // Note: This is a large request (~5MB+), consider caching strategies in production
    return fetchSleeper(`/players/nfl?_=${timestamp}`);
};

/**
 * Fetch specific league details
 * @param {string} leagueId 
 */
export const fetchLeague = async (leagueId) => {
    const timestamp = Date.now();
    return fetchSleeper(`/league/${leagueId}?_=${timestamp}`);
};

/**
 * Fetch draft picks for a specific draft
 * @param {string} draftId 
 */
export const fetchDraftPicks = async (draftId) => {
    const timestamp = Date.now();
    return fetchSleeper(`/draft/${draftId}/picks?_=${timestamp}`);
};

/**
 * Fetch transactions for a specific round (week)
 * @param {string} leagueId 
 * @param {number} round 
 */
export const fetchLeagueTransactions = async (leagueId, round) => {
    const timestamp = Date.now();
    return fetchSleeper(`/league/${leagueId}/transactions/${round}?_=${timestamp}`);
};

/**
 * Fetch traded picks for a league
 * @param {string} leagueId
 */
export const fetchTradedPicks = async (leagueId) => {
    const timestamp = Date.now();
    return fetchSleeper(`/league/${leagueId}/traded_picks?_=${timestamp}`);
};

/**
 * Fetch NFL stats for a specific season (regular season)
 * @param {string} season - e.g., '2024'
 */
export const fetchSeasonStats = async (season) => {
    const timestamp = Date.now();
    return fetchSleeper(`/stats/nfl/regular/${season}?_=${timestamp}`);
};

/**
 * Fetch trending players (add/drop)
 * @param {string} type - 'add' or 'drop'
 * @param {number} lookbackHours - hours to look back (default 24)
 * @param {number} limit - limit results (default 25)
 */
export const fetchTrendingPlayers = async (type = 'add', lookbackHours = 24, limit = 25) => {
    // Note: trending endpoint doesn't need cache busting usually as it changes often
    return fetchSleeper(`/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`);
};

/**
 * Fetch all trade transactions for a specific league (weeks 1-18)
 * @param {string} leagueId
 */
export const fetchSeasonTrades = async (leagueId) => {
    const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
    const promises = weeks.map(week =>
        fetchLeagueTransactions(leagueId, week)
            .catch((err) => {
                console.warn(`Failed to fetch transactions for week ${week}`, err);
                return [];
            })
    );

    const results = await Promise.all(promises);
    // Flatten and filter for trades
    return results.flat().filter(t => t.type === 'trade');
};

/**
 * Recursively fetch trade history across seasons
 * @param {string} currentLeagueId 
 * @param {number} depth - How many seasons back to go (default 3)
 */
export const fetchRecursiveTrades = async (currentLeagueId, depth = 3) => {
    let allTrades = [];
    let processingLeagueId = currentLeagueId;
    let seasonsFetched = 0;

    // We need to fetch league details recursively to find previous_league_id
    // But we might not have the full league object active.
    // So we fetch league details for each step.

    while (processingLeagueId && seasonsFetched <= depth) {
        try {
            // 1. Fetch League Details (to get previous_league_id and season year)
            // Note: If processingLeagueId is currentLeagueId, we might already have details, but fetching safe.
            const leagueDetails = await fetchSleeper(`/league/${processingLeagueId}`);

            // 2. Fetch Trades for this season
            const seasonTrades = await fetchSeasonTrades(processingLeagueId);

            // 3. Add Context (Season Year) to trades if missing
            const yearStr = leagueDetails.season; // e.g., "2024"
            const enrichedTrades = seasonTrades.map(t => ({
                ...t,
                season: yearStr,
                leagueId: processingLeagueId
            }));

            allTrades = [...allTrades, ...enrichedTrades];

            // 4. Prepare next iteration
            processingLeagueId = leagueDetails.previous_league_id;
            seasonsFetched++;

            // Optimization: If no previous league, break.
            if (!processingLeagueId) break;

        } catch (err) {
            console.error(`Error traversing history at league ${processingLeagueId}`, err);
            break;
        }
    }

    return allTrades;
};
