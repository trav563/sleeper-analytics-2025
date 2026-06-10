import { readPlayersCache, writePlayersCache } from './playersCache';

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
    return fetchSleeper(`/league/${leagueId}/users`);
};

/**
 * Fetch rosters in a league
 * @param {string} leagueId 
 */
export const fetchLeagueRosters = async (leagueId) => {
    return fetchSleeper(`/league/${leagueId}/rosters`);
};

/**
 * Fetch matchups for a specific week
 * @param {string} leagueId
 * @param {number|string} week
 * @param {boolean} fresh - bypass the CDN edge cache (~60s TTL); use only for
 *   the live week, where score freshness matters. Past weeks are immutable.
 */
export const fetchLeagueMatchups = async (leagueId, week, fresh = false) => {
    const bust = fresh ? `?_=${Date.now()}` : '';
    return fetchSleeper(`/league/${leagueId}/matchups/${week}${bust}`);
};

/**
 * Fetch current NFL state (week, season type, etc.)
 */
export const fetchNFLState = async () => {
    const timestamp = Date.now();
    return fetchSleeper(`/state/nfl?_=${timestamp}`);
};

/**
 * Fetch all NFL players (~5MB payload). Served from IndexedDB when a
 * fresh-enough copy exists (24h TTL) so reloads don't re-download it.
 */
export const fetchNFLPlayers = async () => {
    const cached = await readPlayersCache();
    if (cached) return cached;
    const data = await fetchSleeper('/players/nfl');
    writePlayersCache(data);
    return data;
};

/**
 * Fetch specific league details
 * @param {string} leagueId 
 */
export const fetchLeague = async (leagueId) => {
    return fetchSleeper(`/league/${leagueId}`);
};

/**
 * Fetch draft picks for a specific draft
 * @param {string} draftId
 */
export const fetchDraftPicks = async (draftId) => {
    return fetchSleeper(`/draft/${draftId}/picks`);
};

/**
 * Fetch all drafts attached to a league (startup, rookie, supplemental).
 * @param {string} leagueId
 */
export const fetchLeagueDrafts = async (leagueId) => {
    return fetchSleeper(`/league/${leagueId}/drafts`);
};

/**
 * Derive whether rookies are currently locked (un-pickable from waivers).
 * Dynasty/keeper leagues with a pending current-season draft block rookie
 * pickups in Sleeper itself; we mirror that rule so suggestions don't
 * surface unattainable players.
 *
 * @param {object} league   league object from /league/{id}
 * @param {array}  drafts   array from /league/{id}/drafts
 * @returns {{ rookiesLocked: boolean, nextDraftStartTime: number|null, label: string }}
 */
export const getRookieLockState = (league, drafts) => {
    const out = { rookiesLocked: false, nextDraftStartTime: null, label: '' };
    if (!league || !Array.isArray(drafts)) return out;
    const type = league.settings?.type;
    // Dynasty (2) and keeper (1) leagues lock rookies before their rookie draft.
    if (type !== 1 && type !== 2) return out;
    const season = String(league.season || '');
    const pending = drafts.filter(
        (d) => String(d?.season || '') === season &&
            (d?.status === 'pre_draft' || d?.status === 'drafting')
    );
    if (pending.length === 0) return out;
    const drafting = pending.find((d) => d.status === 'drafting');
    out.rookiesLocked = true;
    out.label = drafting ? 'Rookie draft live' : 'Rookie draft pending';
    const soonest = pending
        .map((d) => Number(d?.start_time) || 0)
        .filter((t) => t > 0)
        .sort((a, b) => a - b)[0];
    out.nextDraftStartTime = soonest || null;
    return out;
};

/**
 * Fetch transactions for a specific round (week)
 * @param {string} leagueId 
 * @param {number} round 
 */
export const fetchLeagueTransactions = async (leagueId, round) => {
    return fetchSleeper(`/league/${leagueId}/transactions/${round}`);
};

/**
 * Fetch traded picks for a league
 * @param {string} leagueId
 */
export const fetchTradedPicks = async (leagueId) => {
    return fetchSleeper(`/league/${leagueId}/traded_picks`);
};

/**
 * Fetch NFL stats for a specific season (regular season)
 * @param {string} season - e.g., '2024'
 */
export const fetchSeasonStats = async (season) => {
    return fetchSleeper(`/stats/nfl/regular/${season}`);
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
 * Recursively fetch full transaction history across seasons
 * @param {string} currentLeagueId 
 * @param {number} depth - How many seasons back to go (default 3)
 */
export const fetchFullTransactionHistory = async (currentLeagueId, depth = 3) => {
    let allTrades = [];
    let processedIds = new Set();
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

            // 3. Enrich and Deduplicate
            const yearStr = leagueDetails.season; // e.g., "2024"

            const newTrades = seasonTrades.map(t => ({
                ...t,
                season: yearStr,
                leagueId: processingLeagueId
            })).filter(t => {
                if (processedIds.has(t.transaction_id)) return false;
                processedIds.add(t.transaction_id);
                return true;
            });

            allTrades = [...allTrades, ...newTrades];

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
