/**
 * Shared league-math primitives extracted from logic that was duplicated
 * across the analytics, recap, and history features. These two helpers are
 * behavior-identical to the inline patterns they replace — they do NOT change
 * any displayed numbers.
 *
 * Note: standings/record COMPUTATION was deliberately NOT consolidated here.
 * The app has two intentionally different families — "official" (reads
 * roster.settings.wins/fpts, used by analyze-team and TrueStandings) and
 * "recalculated-from-matchups" (power rankings) — and the recalculated
 * implementations disagree on tie handling. Unifying them would change
 * displayed numbers, so that is left as a separate, explicit decision.
 */

/**
 * Group a flat Sleeper matchups array into head-to-head groups keyed by
 * matchup_id. Returns an array of groups (each the entries sharing a
 * matchup_id). Replicates the exact inline pattern used across the codebase,
 * so callers keep their own `group.length !== 2` guard for byes / odd counts.
 */
export function groupMatchups(matchups) {
    const groups = {};
    (matchups || []).forEach((m) => {
        if (!groups[m.matchup_id]) groups[m.matchup_id] = [];
        groups[m.matchup_id].push(m);
    });
    return Object.values(groups);
}

/**
 * Build a roster_id -> Sleeper user lookup so loops stop repeating the
 * `rosters.find(...).owner_id -> users.find(...)` chain on every iteration.
 * Returns getOwner(rosterId) -> user | undefined, matching the old find-chain
 * result (undefined when the roster or owner is missing).
 */
export function buildOwnerLookup(rosters, users) {
    const userById = new Map((users || []).map((u) => [u.user_id, u]));
    const ownerByRoster = new Map(
        (rosters || []).map((r) => [r.roster_id, userById.get(r.owner_id)])
    );
    return (rosterId) => ownerByRoster.get(rosterId);
}

/**
 * Active roster player ids: roster.players minus taxi squad and IR.
 * Sleeper's roster.players INCLUDES taxi + reserve, so analytics that
 * describe the playable roster (average age, tradeable assets, clogged
 * spots) must exclude them or taxi rookies / IR vets skew the numbers.
 */
export function activeRosterIds(roster) {
    const inactive = new Set([...(roster?.taxi || []), ...(roster?.reserve || [])]);
    return (roster?.players || []).filter((pid) => !inactive.has(pid));
}
