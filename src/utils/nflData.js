// --- 2025 NFL Bye Weeks map (teams by Sleeper/standard abbreviations) ---
// Keep this mapping updated per season. Weeks are NFL regular-season weeks.
// Source: User provided 2025 NFL Bye Week schedule
export const BYE_MAP_2025 = {
    5: ["PIT", "CHI", "GB", "ATL"],
    6: ["HOU", "MIN"],
    7: ["BAL", "BUF"],
    8: ["JAX", "LV", "DET", "ARI", "SEA", "LAR"],
    9: ["PHI", "CLE", "NYJ", "TB"],
    10: ["KC", "CIN", "TEN", "DAL"],
    11: ["IND", "NO"],
    12: ["MIA", "DEN", "LAC", "WAS"],
    13: [], // No teams on bye in Week 13
    14: ["NYG", "NE", "CAR", "SF"],
};

// List of all 32 NFL teams (Sleeper/Standard abbreviations)
export const ALL_NFL_TEAMS = [
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
    "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA",
    "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
    "TEN", "WAS"
];

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
 * Color tokens for status
 */
export const STATUS_COLORS = {
    BG: {
        OK: "bg-emerald-600",
        POTENTIAL: "bg-amber-500",
        INCOMPLETE: "bg-rose-600",
    },
    LIGHT: {
        OK: "bg-emerald-50 border border-emerald-200",
        POTENTIAL: "bg-amber-50 border border-amber-200",
        INCOMPLETE: "bg-rose-50 border border-rose-200",
    },
    DOT: {
        OK: "bg-emerald-600",
        POTENTIAL: "bg-amber-500",
        INCOMPLETE: "bg-rose-600",
    },
    TEXT: {
        OK: "text-emerald-600",
        POTENTIAL: "text-amber-500",
        INCOMPLETE: "text-rose-600",
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
