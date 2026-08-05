/**
 * CSV row builders for the three rivalry views. Pure — each returns a grid of
 * cells (`string[][]`) for `toCSV`, so the shapes are asserted directly in tests
 * with no DOM involved.
 *
 * Names go through `csvText` (formula-injection guard); numbers never do, so a
 * genuine negative margin stays numeric.
 */
import { csvText } from '../../../utils/csv';
import {
    formatRecord,
    rivalryMargin,
    seasonTotals,
    RIVALRY_BUCKET_LABELS,
    RIVALRY_SCOPE_LABELS,
} from '../../../utils/rivalries';

const localDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
    ).padStart(2, '0')}`;

/** Two-column key/value preamble. Dual values are pre-joined into one cell. */
const preamble = (leagueName, view, scope, extra, generatedAt) => [
    ['League', csvText(leagueName || 'Fantasy League')],
    ['View', view],
    ['Scope', RIVALRY_SCOPE_LABELS[scope] || scope],
    ...extra,
    ['Generated', localDate(generatedAt)],
    [],
];

const pts = (n) => (Number.isFinite(n) ? n.toFixed(1) : '');

/**
 * Head-to-Head tab: the summary plus the full game log.
 * `h2h` is the component's memo — { wins1, wins2, ties, points1, points2, games,
 * playoffGames, history: [{season, week, isPlayoff, score1, score2, winner}] }.
 */
export function buildH2HCsvRows({
    leagueName,
    scope,
    nameA,
    nameB,
    h2h,
    generatedAt = new Date(),
} = {}) {
    if (!h2h) return [];
    const extra = [
        ['Matchup', `${csvText(nameA)} vs ${csvText(nameB)}`],
        ['Record', formatRecord({ w: h2h.wins1, l: h2h.wins2, t: h2h.ties })],
        ['Meetings', h2h.games],
    ];
    if (scope === 'all') extra.push(['Playoff Meetings', h2h.playoffGames || 0]);
    extra.push(['Total Points', `${pts(h2h.points1)} vs ${pts(h2h.points2)}`]);
    if (h2h.games > 0) {
        extra.push([
            'Avg Score',
            `${pts(h2h.points1 / h2h.games)} vs ${pts(h2h.points2 / h2h.games)}`,
        ]);
    }

    const rows = preamble(leagueName, 'Head-to-Head', scope, extra, generatedAt);
    rows.push(['Season', 'Week', 'Type', csvText(nameA), csvText(nameB), 'Winner', 'Margin']);

    (h2h.history || []).forEach((g) => {
        // Derived from the scores rather than the memo's `winner` owner-id, so
        // this builder needs no id plumbing to name the winner.
        const winner = g.score1 > g.score2 ? nameA : g.score2 > g.score1 ? nameB : 'Tie';
        rows.push([
            g.season,
            g.week,
            g.isPlayoff ? 'Playoff' : 'Regular',
            pts(g.score1),
            pts(g.score2),
            csvText(winner),
            Math.abs(g.score1 - g.score2).toFixed(1),
        ]);
    });
    return rows;
}

/**
 * All Rivalries tab: the ACTIVE bucket only, in the order shown on screen.
 * `entries` must already be sorted, so Rank matches the row numbering.
 */
export function buildBucketCsvRows({
    leagueName,
    scope,
    bucket,
    entries,
    nameOf,
    generatedAt = new Date(),
} = {}) {
    const list = entries || [];
    const label = RIVALRY_BUCKET_LABELS[bucket] || bucket || '';
    const rows = preamble(
        leagueName,
        'All Rivalries',
        scope,
        [
            ['Bucket', label],
            ['Pairs', list.length],
        ],
        generatedAt
    );
    rows.push([
        'Rank',
        'Bucket',
        'Team A',
        'Team B',
        'W',
        'L',
        'T',
        'Meetings',
        'Margin',
        'Playoff Meetings',
    ]);

    list.forEach((entry, i) => {
        const r = entry[scope] || {};
        rows.push([
            i + 1,
            label,
            csvText(nameOf(entry.aId)),
            csvText(nameOf(entry.bId)),
            r.w ?? 0,
            r.l ?? 0,
            r.t ?? 0,
            r.g ?? 0,
            rivalryMargin(r),
            r.playoffGames ?? 0,
        ]);
    });
    return rows;
}

/**
 * One vs All tab: one row per opponent, with a column per season the manager
 * actually played, plus a TOTAL row.
 *
 * A season with no meeting is an EMPTY cell here where the UI shows an em dash —
 * the one deliberate divergence from "exactly what's on screen", since a dash is
 * noise in a spreadsheet.
 */
export function buildManagerCsvRows({
    leagueName,
    scope,
    managerName,
    split,
    nameOf,
    generatedAt = new Date(),
} = {}) {
    if (!split?.rows?.length) return [];
    const { seasons, rows: opponents, total } = split;

    const rows = preamble(
        leagueName,
        'One vs All',
        scope,
        [
            ['Manager', csvText(managerName)],
            ['Opponents', opponents.length],
            ['Record vs current managers', formatRecord(total)],
        ],
        generatedAt
    );
    rows.push(['Opponent', 'Lifetime', 'W', 'L', 'T', 'Meetings', ...seasons]);

    opponents.forEach((row) => {
        rows.push([
            csvText(nameOf(row.opponentId)),
            formatRecord(row.total),
            row.total.w,
            row.total.l,
            row.total.t,
            row.total.g,
            ...seasons.map((s) => (row.bySeason[s] ? formatRecord(row.bySeason[s]) : '')),
        ]);
    });

    // Shared with the table footer so the two can't drift.
    rows.push([
        'TOTAL',
        formatRecord(total),
        total.w,
        total.l,
        total.t,
        total.g,
        ...seasonTotals(opponents, seasons).map(formatRecord),
    ]);
    return rows;
}
