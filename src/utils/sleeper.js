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

