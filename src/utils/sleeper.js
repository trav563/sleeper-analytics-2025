import { readPlayersCache, writePlayersCache } from './playersCache';

const BASE_URL = 'https://api.sleeper.app/v1';

/**
 * Generic fetcher for Sleeper API
 * @param {string} endpoint - The API endpoint to call (e.g., '/user/username')
 * @returns {Promise<any>} - The JSON response
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const fetchSleeper = async (endpoint, { retries = 2, signal } = {}) => {
    let attempt = 0;
    // Retry transient failures (network errors, 429, 5xx) with exponential
    // backoff; 4xx other than 429 fail fast. This protects the direct-fetch
    // callers that have no retry of their own — React Query layers its own
    // retry on top of the hooked queries.
    while (true) {
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, { signal });
            if (response.ok) return await response.json();

            const retryable = response.status === 429 || response.status >= 500;
            if (retryable && attempt < retries) {
                const retryAfter = Number(response.headers.get('retry-after'));
                const wait = retryAfter > 0 && retryAfter <= 10
                    ? retryAfter * 1000
                    : 400 * 2 ** attempt;
                attempt++;
                await sleep(wait);
                continue;
            }
            throw new Error(`Sleeper API Error: ${response.status} ${response.statusText}`);
        } catch (error) {
            // Cancellation is not a failure — propagate without retry or noise.
            if (error?.name === 'AbortError') throw error;
            // fetch() throws TypeError on network failure — retry those too.
            if (error instanceof TypeError && attempt < retries) {
                await sleep(400 * 2 ** attempt);
                attempt++;
                continue;
            }
            console.error('Error fetching from Sleeper API:', error);
            throw error;
        }
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
 * @param {string} season - e.g., '2024' (required; callers resolve it from NFL state)
 */
export const fetchUserLeagues = async (userId, season) => {
    if (!season) throw new Error('fetchUserLeagues requires a season');
    return fetchSleeper(`/user/${userId}/leagues/nfl/${season}`);
};

/**
 * Fetch users in a league
 * @param {string} leagueId 
 */
export const fetchLeagueUsers = async (leagueId, opts) => {
    return fetchSleeper(`/league/${leagueId}/users`, opts);
};

/**
 * Fetch rosters in a league
 * @param {string} leagueId 
 */
export const fetchLeagueRosters = async (leagueId, opts) => {
    return fetchSleeper(`/league/${leagueId}/rosters`, opts);
};

/**
 * Fetch matchups for a specific week
 * @param {string} leagueId
 * @param {number|string} week
 * @param {boolean} fresh - bypass the CDN edge cache (~60s TTL); use only for
 *   the live week, where score freshness matters. Past weeks are immutable.
 */
export const fetchLeagueMatchups = async (leagueId, week, fresh = false, opts) => {
    const bust = fresh ? `?_=${Date.now()}` : '';
    return fetchSleeper(`/league/${leagueId}/matchups/${week}${bust}`, opts);
};

/**
 * Fetch a league's winners (championship) bracket. Bracket round `r` maps to
 * week `playoff_week_start + r - 1`. Needed to tell real playoff meetings apart
 * from consolation / toilet-bowl games, which share the same weeks.
 * @param {string} leagueId
 */
export const fetchWinnersBracket = async (leagueId) => {
    return fetchSleeper(`/league/${leagueId}/winners_bracket`);
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
export const fetchLeague = async (leagueId, opts) => {
    return fetchSleeper(`/league/${leagueId}`, opts);
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
export const fetchLeagueTransactions = async (leagueId, round, opts) => {
    return fetchSleeper(`/league/${leagueId}/transactions/${round}`, opts);
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
 * Weekly projections: player_id -> raw projected stat line (plus precomputed
 * pts_ppr/half/std). Score it with the league's own settings via
 * src/utils/scoring.js rather than reading the precomputed fields.
 * @param {string} season
 * @param {number|string} week
 */
export const fetchWeekProjections = async (season, week) => {
    return fetchSleeper(`/projections/nfl/regular/${season}/${week}`);
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
