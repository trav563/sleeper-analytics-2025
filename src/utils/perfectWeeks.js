/**
 * Perfect weeks: a team-week where the manager started exactly the right lineup,
 * so the actual score equals the most the roster could possibly have scored.
 *
 * The optimum comes from the same exact assignment solver the recap uses for
 * bench points, so these numbers agree with the rest of the app. Validated
 * against Sleeper's own `settings.ppts` ("potential points") in
 * research/perfect-weeks — regular-season sums match to the cent.
 *
 * Caveat worth surfacing in the UI: the pool is the end-of-week roster, which
 * can include a player who was not actually startable that week (on IR, or
 * added after lineups locked). Sleeper excludes those from potential points and
 * we cannot, because historical IR membership is not in the API. That can only
 * make the optimum too high — i.e. miss a perfect week, never invent one — so
 * any count derived from this is a floor.
 */

import { assignLineup, SLOT_ELIGIBILITY } from './lineupAssignment';
import { MAX_SCORED_WEEK, DEFAULT_PLAYOFF_WEEK_START } from './rivalries';

/** Scores are reported to the cent, so anything closer than this is equality. */
export const PERFECT_WEEK_EPSILON = 0.005;

/** How close a miss has to be to be worth showing as a near miss. */
export const NEAR_MISS_POINTS = 1;

/** Slots a lineup must actually fill — bench, IR and taxi are not scored. */
export function scoringSlots(slots) {
    return (slots || []).filter(slot => SLOT_ELIGIBILITY[slot]);
}

/** What the team scored, or null when any starter's score is missing. */
export function actualScore(matchup) {
    const points = matchup?.starters_points;
    if (!Array.isArray(points) || points.length === 0) return null;
    if (points.some(p => !Number.isFinite(p))) return null;
    return points.reduce((sum, p) => sum + p, 0);
}

/** The best lineup available from everyone on the roster that week. */
export function optimalLineup(matchup, slots, players) {
    const scored = matchup?.players_points || {};
    const pool = (matchup?.players || [])
        .filter(id => players?.[id] && Number.isFinite(scored[id]))
        .map(id => ({ ...players[id], id, points: scored[id] }));
    return assignLineup(slots || [], pool, p => p.points);
}

/**
 * True once at least one team in the week has scored. Guards unplayed weeks,
 * where every roster sits at zero and would otherwise look trivially perfect.
 */
export function weekWasPlayed(weekMatchups) {
    return (weekMatchups || []).some(m => (m?.points || 0) > 0);
}

const describe = player => player && ({
    name: player.full_name || player.id,
    position: player.position || null,
    points: player.points,
});

/**
 * One team-week, fully judged: what they scored, the most they could have, and
 * the single change that separates the two. Returns null when the week can't be
 * judged (missing starter scores, or a roster that couldn't field the lineup).
 */
export function analyzeTeamWeek(matchup, slots, players) {
    const actual = actualScore(matchup);
    if (actual === null) return null;

    const { assignments, total, filled } = optimalLineup(matchup, slots, players);
    // An unfillable lineup means incomplete roster data, not a perfect manager;
    // a 0-of-0 "optimum" would otherwise match a 0 score.
    if (filled === 0 || filled !== scoringSlots(slots).length) return null;

    const started = new Set(matchup?.starters || []);
    const chosen = Object.values(assignments).filter(Boolean);
    const chosenIds = new Set(chosen.map(p => p.id));
    const scored = matchup?.players_points || {};

    const benched = (matchup?.players || [])
        .filter(id => !started.has(id) && players?.[id] && Number.isFinite(scored[id]))
        .map(id => ({ ...players[id], id, points: scored[id] }))
        .sort((a, b) => b.points - a.points);

    const swapIn = chosen.filter(p => !started.has(p.id)).sort((a, b) => b.points - a.points)[0];
    const swapOut = [...started]
        .filter(id => !chosenIds.has(id) && players?.[id])
        .map(id => ({ ...players[id], id, points: scored[id] ?? 0 }))
        .sort((a, b) => a.points - b.points)[0];

    return {
        actual,
        optimal: total,
        gap: total - actual,
        perfect: Math.abs(total - actual) < PERFECT_WEEK_EPSILON,
        benchBest: describe(benched[0]),
        swapIn: describe(swapIn),
        swapOut: describe(swapOut),
    };
}

/** Did this team score every point its roster had available that week? */
export function isPerfectWeek(matchup, slots, players) {
    return analyzeTeamWeek(matchup, slots, players)?.perfect === true;
}

/**
 * Roll every scored team-week in the league's history into the numbers the
 * Perfect Weeks panel shows.
 *
 * `seasons` is the caller's already-fetched history, one entry per season:
 *   { season, slots, playoffWeekStart, weeks: [[matchup, ...], ...],
 *     resolveTeam: rosterId => ({ key, name, avatar }) }
 * `weeks` is indexed from week 1; weeks past the league's last contested week
 * and weeks nobody played are skipped here so callers don't each re-derive it.
 * `players` is the NFL player map, used for slot eligibility and names.
 */
export function summarizePerfectWeeks(seasons, players) {
    const occurrences = [];
    const nearMisses = [];
    const bySeason = [];
    let teamWeeks = 0;
    let regularSeason = 0;
    let postseason = 0;

    [...(seasons || [])]
        .sort((a, b) => Number(a.season) - Number(b.season))
        .forEach(({ season, slots, playoffWeekStart, weeks, resolveTeam }) => {
            if (!slots?.length) return;
            const playoffStart = playoffWeekStart || DEFAULT_PLAYOFF_WEEK_START;
            let seasonTeamWeeks = 0;
            let seasonWeeks = 0;
            let seasonPerfect = 0;

            (weeks || []).forEach((weekMatchups, index) => {
                const week = index + 1;
                // Week 18 is fetched but never contested — no matchups exist there.
                if (week > MAX_SCORED_WEEK || !weekWasPlayed(weekMatchups)) return;
                seasonWeeks += 1;

                weekMatchups.forEach(matchup => {
                    const judged = analyzeTeamWeek(matchup, slots, players);
                    if (!judged) return;
                    seasonTeamWeeks += 1;
                    const team = resolveTeam(matchup.roster_id);
                    const entry = { season, week, ...team, ...judged };

                    if (judged.perfect) {
                        seasonPerfect += 1;
                        occurrences.push(entry);
                        if (week < playoffStart) regularSeason += 1; else postseason += 1;
                    } else if (judged.gap <= NEAR_MISS_POINTS) {
                        nearMisses.push(entry);
                    }
                });
            });

            teamWeeks += seasonTeamWeeks;
            bySeason.push({ season, perfect: seasonPerfect, teamWeeks: seasonTeamWeeks, weeks: seasonWeeks });
        });

    const holders = new Map();
    occurrences.forEach(o => {
        if (!holders.has(o.key)) holders.set(o.key, { key: o.key, name: o.name, avatar: o.avatar, weeks: [] });
        holders.get(o.key).weeks.push(o);
    });
    const byManager = [...holders.values()]
        .map(h => ({ ...h, count: h.weeks.length }))
        .sort((a, b) => b.count - a.count || Number(b.weeks.at(-1).season) - Number(a.weeks.at(-1).season));

    return {
        total: occurrences.length,
        teamWeeks,
        regularSeason,
        postseason,
        rate: teamWeeks ? occurrences.length / teamWeeks : 0,
        oneIn: occurrences.length ? Math.round(teamWeeks / occurrences.length) : null,
        bySeason,
        byManager,
        occurrences: [...occurrences].sort((a, b) => Number(b.season) - Number(a.season) || b.week - a.week),
        nearMisses: nearMisses.sort((a, b) => a.gap - b.gap).slice(0, 5),
    };
}
