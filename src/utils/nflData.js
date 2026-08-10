// Per-season NFL bye weeks derived from nflverse schedule data.
// Regenerate with `npm run update-byes` when a new schedule drops.
import byeWeeks from '../data/byeWeeks.json';

// List of all 32 NFL teams (Sleeper/Standard abbreviations)
export const ALL_NFL_TEAMS = [
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
    "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA",
    "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
    "TEN", "WAS"
];

/**
 * Bye-week map for a season: { week: [teamAbbr, ...] }.
 * Returns {} for seasons not in the generated data.
 * @param {string|number} season
 */
export function getByeMap(season) {
    return byeWeeks[String(season)] || {};
}

// Indoor stadiums — skip weather alerts for these teams (domes/retractable roofs)
export const INDOOR_STADIUMS = new Set([
    'ARI', 'ATL', 'DAL', 'DET', 'HOU', 'IND', 'LAC', 'LAR', 'LV', 'MIN', 'NO'
]);

// Position display order for lineup
export const POSITION_ORDER = {
    QB: 1,
    RB: 2,
    WR: 3,
    TE: 4,
    FLEX: 5,
    K: 6,
    DEF: 7,
};

/**
 * Color tokens for lineup status. Semantic broadcast tokens:
 *   OK         → good   (green)
 *   POTENTIAL  → warn   (amber)
 *   INCOMPLETE → bad    (red)
 */
export const STATUS_COLORS = {
    BG: {
        OK: "bg-good",
        POTENTIAL: "bg-warn",
        INCOMPLETE: "bg-bad",
    },
    LIGHT: {
        OK: "bg-good/10 border border-good/30",
        POTENTIAL: "bg-warn/10 border border-warn/30",
        INCOMPLETE: "bg-bad/10 border border-bad/30",
    },
    DOT: {
        OK: "bg-good",
        POTENTIAL: "bg-warn",
        INCOMPLETE: "bg-bad",
    },
    TEXT: {
        OK: "text-good",
        POTENTIAL: "text-warn",
        INCOMPLETE: "text-bad",
    }
};

/**
 * Get avatar URL from Sleeper CDN
 */
export function avatarUrl(avatarId, size = "thumbs") {
    if (!avatarId) return null;
    return `https://sleepercdn.com/avatars/${size === "thumbs" ? "thumbs/" : ""}${avatarId}`;
}

/**
 * Get player headshot URL from Sleeper CDN
 */
export function playerHeadshotUrl(playerId) {
    if (!playerId) return null;
    return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
}

/**
 * Get display name for a team/user
 */
export function displayTeamName(user) {
    return (
        user?.metadata?.team_name || user?.display_name || user?.username || `Team ${user?.user_id}`
    );
}

/**
 * Check if player ID is a D/ST (Defense/Special Teams)
 */
export function isDSTStarterId(pid) {
    return /^[A-Z]{2,4}$/.test(pid); // e.g., "PHI", "KC" as D/ST codes
}

/**
 * Classify player injury status
 */
export function classifyInjury(player) {
    const inj = String(player?.injury_status || "").toLowerCase();
    const status = String(player?.status || "").toLowerCase();

    // Treat IR/Suspended/PUP as OUT as requested
    if (["out", "ir", "suspended", "pup"].includes(inj) || ["ir", "suspension", "pup"].includes(status))
        return "INCOMPLETE";

    if (["questionable", "doubtful"].includes(inj)) return "POTENTIAL";

    return "OK";
}
