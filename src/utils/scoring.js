/**
 * League-aware fantasy scoring.
 *
 * Sleeper's stat and projection payloads use the SAME keys as a league's
 * `scoring_settings` (pass_yd, rush_td, rec, bonus_rec_te, pts_allow_21_27,
 * fgm_yds, …), so a league's exact points for any stat line is just the dot
 * product of the two objects. That matters: a league scoring INTs at -2
 * instead of Sleeper's -1, or awarding 0.1/yd on field goals, gets numbers
 * the precomputed pts_ppr / pts_half_ppr / pts_std fields can't express.
 */

/** Season-total field matching the league's reception scoring. */
export function ppgField(scoringSettings) {
    const rec = scoringSettings?.rec ?? 1; // default to PPR when unknown
    if (rec >= 1) return 'pts_ppr';
    if (rec >= 0.5) return 'pts_half_ppr';
    return 'pts_std';
}

/**
 * Exact league points for a raw stat line. Returns null when the two objects
 * share no scoring keys, so callers can fall back rather than show a zero.
 */
export function scoreStatLine(stats, scoringSettings) {
    if (!stats || !scoringSettings) return null;
    let total = 0;
    let matched = 0;
    for (const [key, weight] of Object.entries(scoringSettings)) {
        const value = stats[key];
        if (typeof value === 'number' && typeof weight === 'number') {
            total += value * weight;
            matched++;
        }
    }
    return matched > 0 ? total : null;
}

/**
 * Projected points for one player, preferring the league's own scoring and
 * falling back to Sleeper's precomputed field when the stat line can't be
 * scored (unexpected payload shape).
 */
export function projectedPoints(stats, scoringSettings) {
    if (!stats) return 0;
    const exact = scoreStatLine(stats, scoringSettings);
    if (exact != null) return exact;
    return stats[ppgField(scoringSettings)] ?? stats.pts_ppr ?? 0;
}
