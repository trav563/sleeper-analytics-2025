/**
 * All-time league records, each as a ranked list rather than a single holder,
 * so the record book can show the leader with its runners-up behind it.
 *
 * Takes the per-season views from features/history/seasonViews.
 */

import { lineupIsComplete } from './lineupAssignment';

/** How deep each record list goes: the holder plus four runners-up. */
export const RECORD_DEPTH = 5;

/** Oldest first, so a win streak accumulates in the order it was played. */
const chronological = seasons =>
    [...(seasons || [])].sort((a, b) => Number(a.season) - Number(b.season));

/** Both sides of a head-to-head, keyed by matchup. Byes have no opponent. */
const pairsInWeek = weekMatchups => {
    const byMatchup = new Map();
    (weekMatchups || []).forEach(m => {
        const side = byMatchup.get(m.matchup_id) || [];
        side.push(m);
        byMatchup.set(m.matchup_id, side);
    });
    return [...byMatchup.values()].filter(pair => pair.length === 2);
};

export function buildRecordBook(seasons, depth = RECORD_DEPTH) {
    const scores = [];
    const matchups = [];
    const streaks = [];
    const running = new Map(); // team key -> the streak currently alive

    // A streak is recorded when it ends, at the length and week it peaked, so
    // every run competes for the record — not just the best one so far.
    const endStreak = key => {
        const run = running.get(key);
        if (run) streaks.push(run);
        running.delete(key);
    };

    chronological(seasons).forEach(({ season, slots, weeks, resolveTeam }) => {
        (weeks || []).forEach((weekMatchups, index) => {
            const week = index + 1;

            pairsInWeek(weekMatchups).forEach(([m1, m2]) => {
                if (!Number.isFinite(m1.points) || !Number.isFinite(m2.points)) return;
                const t1 = resolveTeam(m1.roster_id);
                const t2 = resolveTeam(m2.roster_id);

                [[m1, t1], [m2, t2]].forEach(([m, team]) => scores.push({
                    ...team, season, week,
                    points: m.points,
                    lineupComplete: lineupIsComplete(m, slots),
                }));

                matchups.push({
                    season, week,
                    diff: Math.abs(m1.points - m2.points),
                    // Non-breaking space after "vs" so a wrapped row breaks
                    // between the two teams, not after the word joining them.
                    name: `${t1.name} vs\u00A0${t2.name}`,
                    avatar: t1.avatar,
                    high: Math.max(m1.points, m2.points),
                    low: Math.min(m1.points, m2.points),
                });

                if (m1.points === m2.points) {
                    endStreak(t1.key);
                    endStreak(t2.key);
                    return;
                }
                const [winner, loser] = m1.points > m2.points ? [t1, t2] : [t2, t1];
                const run = running.get(winner.key);
                running.set(winner.key, { ...winner, count: (run?.count || 0) + 1, season, week });
                endStreak(loser.key);
            });
        });
    });

    // Streaks still alive when the history runs out still count.
    [...running.keys()].forEach(endStreak);

    const deepest = (list, compare) => [...list].sort(compare).slice(0, depth);
    const bySeasonWeek = (a, b) => Number(a.season) - Number(b.season) || a.week - b.week;
    // `sub` is the second line a runner-up row shows under the date — only the
    // matchup record has one, where the margin means little without the scores.
    const entry = (row, value, detail, sub) => ({
        value, detail, sub,
        teamName: row.name,
        avatar: row.avatar,
        year: row.season,
        week: row.week,
    });

    return {
        highestScore: deepest(scores, (a, b) => b.points - a.points || bySeasonWeek(a, b))
            .map(row => entry(row, row.points.toFixed(2), 'Points')),

        // An abandoned lineup (Sleeper pads the empty slots with "0") is a
        // forfeit, not a low score. A full lineup that scored badly still counts.
        lowestScore: deepest(scores.filter(s => s.lineupComplete), (a, b) => a.points - b.points || bySeasonWeek(a, b))
            .map(row => entry(row, row.points.toFixed(2), 'Points · full lineup')),

        // Two decimals, not one: at one decimal a 0.12 margin prints as
        // "118.4 - 118.3" and reads like it contradicts its own diff.
        closestMatch: deepest(matchups, (a, b) => a.diff - b.diff || bySeasonWeek(a, b))
            .map(row => {
                const scores = `${row.high.toFixed(2)} - ${row.low.toFixed(2)}`;
                return entry(row, row.diff.toFixed(2), `Diff (${scores})`, scores);
            }),

        longestStreak: deepest(streaks, (a, b) => b.count - a.count || bySeasonWeek(a, b))
            .map(row => entry(row, row.count, 'Consecutive Wins')),
    };
}
