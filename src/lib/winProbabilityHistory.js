// A sample lands every 5 minutes while games are on, so a longer silence inside
// a game window means samples were missed, and a much longer one is the idle
// time between windows (Thursday night to Sunday), which the chart collapses.
export const HISTORY_GAP_MS = 15 * 60_000;
export const WINDOW_GAP_MS = 60 * 60_000;
const MIN_WINDOW_SPAN_MS = 60 * 60_000;
const LEGACY_STORAGE_KEY = 'league-win-history-v1-uncertainty45';

/** Browser-recorded history predates server sampling and is no longer read. */
export function clearLegacyProbabilityHistory() {
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Storage unavailable: nothing to clear. */ }
}

/** One matchup's series from league-wide samples of { at, p: { [matchupId]: p } }. */
export function matchupProbabilityPoints(samples, matchupId) {
    const points = [];
    for (const sample of samples || []) {
        const p = sample.p?.[matchupId];
        if (Number.isFinite(sample.at) && Number.isFinite(p) && p >= 0 && p <= 1) points.push({ at: sample.at, p });
    }
    return points;
}

/** Split missing observation windows instead of implying continuous coverage. */
export function probabilitySegments(points) {
    const segments = [];
    for (const point of points) {
        const segment = segments.at(-1);
        if (!segment || point.at - segment.at(-1).at > HISTORY_GAP_MS) segments.push([point]);
        else segment.push(point);
    }
    return segments;
}

/**
 * Lay points out with idle time removed: game windows sit side by side, each as
 * wide as its share of game time. Each returned point gains an `x`.
 */
export function layoutProbabilityWindows(points, { left = 12, width = 296, gutter = 10 } = {}) {
    const groups = [];
    for (const point of points) {
        const group = groups.at(-1);
        if (!group || point.at - group.at(-1).at > WINDOW_GAP_MS) groups.push([point]);
        else group.push(point);
    }
    const spans = groups.map(group => Math.max(group.at(-1).at - group[0].at, MIN_WINDOW_SPAN_MS));
    const scale = (width - gutter * (groups.length - 1)) / spans.reduce((sum, span) => sum + span, 0);
    let cursor = left;
    return groups.map((group, i) => {
        const x0 = cursor, x1 = cursor + spans[i] * scale;
        cursor = x1 + gutter;
        const placed = group.map(point => ({ ...point, x: group.length === 1 ? (x0 + x1) / 2 : x0 + (point.at - group[0].at) * scale }));
        return { x0, x1, start: group[0].at, points: placed, segments: probabilitySegments(placed) };
    });
}
