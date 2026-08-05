/**
 * Head-to-head ("rivalry") aggregation across a league's full
 * previous_league_id chain.
 *
 * Why this lives here and not in leagueMath.js: that module documents a
 * deliberate decision to leave standings/record computation alone, because the
 * app carries two intentionally different families ("official" roster.settings
 * vs "recalculated-from-matchups") that disagree on tie handling. Head-to-head
 * is orthogonal to that split, so it gets its own home rather than reopening it.
 *
 * Two scopes are produced per pair:
 *   reg — regular season only: weeks before that season's playoff_week_start
 *   all — regular season plus real playoff meetings
 *
 * Consolation games are excluded from BOTH scopes. Postseason weeks contain the
 * championship bracket and the loser bracket side by side, so a postseason game
 * only counts when the winners bracket confirms those two teams actually met in
 * that round. That is why callers must supply the bracket.
 *
 * "Consolation" also covers placement games INSIDE the winners bracket (third
 * place, fifth place). Those are played by teams already eliminated from the
 * championship, so counting them while excluding the loser bracket would be an
 * arbitrary line. Only the championship path counts — see buildPlayoffKeys.
 */
import { groupMatchups } from './leagueMath';

/** Fallback only — real value comes from league.settings.playoff_week_start. */
export const DEFAULT_PLAYOFF_WEEK_START = 15;

/** Last week Sleeper scores; playoff rounds land inside this range. */
export const MAX_SCORED_WEEK = 17;

/** Stable key for an unordered pair of owner ids. */
export function pairKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * The set of real playoff games for one season, as `${week}|${pairKey}` strings.
 *
 * Bracket round `r` maps to week `playoffWeekStart + r - 1`. Entries whose
 * t1/t2 are still `{ w: matchId }` / `{ l: matchId }` placeholders have not been
 * played, so they are skipped — that is what stops an in-progress postseason
 * from inventing meetings.
 *
 * Sleeper marks a placement game with `p`: the game decides places `p` and
 * `p + 1`. So `p === 1` is the championship final, while `p === 3` / `p === 5`
 * are the third- and fifth-place games — played by teams already knocked out.
 * Those are consolation in substance and are excluded; only advancement games
 * (`p == null`) and the final count.
 */
export function buildPlayoffKeys(winnersBracket, playoffWeekStart, rosterIdToOwnerId) {
    const keys = new Set();
    const pws = playoffWeekStart || DEFAULT_PLAYOFF_WEEK_START;
    (winnersBracket || []).forEach((m) => {
        if (!m || typeof m.t1 !== 'number' || typeof m.t2 !== 'number') return;
        if (m.p != null && m.p !== 1) return; // placement game, not the championship path
        const a = rosterIdToOwnerId?.[m.t1];
        const b = rosterIdToOwnerId?.[m.t2];
        if (!a || !b) return;
        keys.add(`${pws + (m.r - 1)}|${pairKey(a, b)}`);
    });
    return keys;
}

const blankRecord = () => ({
    w: 0,
    l: 0,
    t: 0,
    g: 0,
    pointsA: 0,
    pointsB: 0,
    playoffGames: 0,
});

function accumulate(record, pointsA, pointsB, isPlayoff) {
    record.g += 1;
    record.pointsA += pointsA;
    record.pointsB += pointsB;
    if (isPlayoff) record.playoffGames += 1;
    if (pointsA > pointsB) record.w += 1;
    else if (pointsB > pointsA) record.l += 1;
    else record.t += 1; // exact tie — counted, not silently dropped
}

/**
 * Aggregate every head-to-head series in a league's history.
 *
 * @param {Object} input
 * @param {Array}  input.seasons - one entry per season:
 *   `{ season, playoffWeekStart, rosterIdToOwnerId, weeks, playoffKeys }`
 *   where `weeks[i]` is the raw Sleeper matchups array for week `i + 1` and
 *   `playoffKeys` comes from {@link buildPlayoffKeys}.
 * @param {string[]} input.currentOwnerIds - owners to include. Every pair among
 *   them is seeded, so a pair that has never met still gets an entry and the row
 *   count is deterministic (n choose 2).
 * @returns {Array<{aId: string, bId: string, reg: Object, all: Object, games: Array}>}
 *   `reg`/`all` are records oriented so wins belong to `aId`. `games` is
 *   chronological.
 */
export function buildRivalries({ seasons, currentOwnerIds } = {}) {
    const ids = [...new Set((currentOwnerIds || []).filter(Boolean))];
    const allowed = ids.length ? new Set(ids) : null;
    const byPair = new Map();

    const ensure = (a, b) => {
        const key = pairKey(a, b);
        let entry = byPair.get(key);
        if (!entry) {
            const [aId, bId] = a < b ? [a, b] : [b, a];
            entry = { aId, bId, reg: blankRecord(), all: blankRecord(), games: [] };
            byPair.set(key, entry);
        }
        return entry;
    };

    // Seed all pairs up front so "never met" is a visible 0-0 row rather than a
    // missing one, and so the caller can assert an exact row count.
    for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) ensure(ids[i], ids[j]);
    }

    (seasons || []).forEach((season) => {
        const pws = season?.playoffWeekStart || DEFAULT_PLAYOFF_WEEK_START;
        const owners = season?.rosterIdToOwnerId || {};

        (season?.weeks || []).forEach((weekMatchups, index) => {
            const week = index + 1;
            const isRegular = week < pws;

            // A null matchup_id means "no game this week". Drop those before
            // grouping — otherwise they all collapse into one bogus bucket
            // (documented in leagueMath.test.js).
            const played = (weekMatchups || []).filter((m) => m && m.matchup_id != null);

            groupMatchups(played).forEach((group) => {
                if (group.length !== 2) return; // bye / odd count
                const [ma, mb] = group;
                const ownerA = owners[ma.roster_id];
                const ownerB = owners[mb.roster_id];
                if (!ownerA || !ownerB || ownerA === ownerB) return;
                if (allowed && (!allowed.has(ownerA) || !allowed.has(ownerB))) return;

                const scoreA = ma.points || 0;
                const scoreB = mb.points || 0;
                if (scoreA === 0 && scoreB === 0) return; // scheduled, not played

                const isPlayoff =
                    !isRegular &&
                    !!season?.playoffKeys?.has(`${week}|${pairKey(ownerA, ownerB)}`);

                // Postseason week that isn't in the championship bracket is a
                // consolation game — excluded from both scopes.
                if (!isRegular && !isPlayoff) return;

                const entry = ensure(ownerA, ownerB);
                const flip = entry.aId !== ownerA;
                const pointsA = flip ? scoreB : scoreA;
                const pointsB = flip ? scoreA : scoreB;

                entry.games.push({ season: season.season, week, pointsA, pointsB, isPlayoff });
                accumulate(entry.all, pointsA, pointsB, isPlayoff);
                if (isRegular) accumulate(entry.reg, pointsA, pointsB, false);
            });
        });
    });

    const list = [...byPair.values()];
    list.forEach((entry) => {
        entry.games.sort(
            (x, y) => String(x.season).localeCompare(String(y.season)) || x.week - y.week
        );
    });
    return list;
}

/**
 * How even a series is, measured as games played in its balanced core:
 * 5-4 and 4-4 both score 8, 6-0 scores 0. Rewards volume and evenness at once,
 * which is what separates a rivalry from a lopsided pairing.
 */
export function rivalryBalance(record) {
    if (!record) return 0;
    return 2 * Math.min(record.w, record.l) + record.t;
}

/** Games separating the two sides. */
export function rivalryMargin(record) {
    if (!record) return 0;
    return Math.abs(record.w - record.l);
}

export const RIVALRY_SORTS = ['closest', 'meetings', 'lopsided'];

/**
 * Sort rivalries for display. Every comparator ends on the pair key so the
 * order is fully deterministic rather than dependent on insertion order.
 *
 * @param {Array}  list
 * @param {'closest'|'meetings'|'lopsided'} sortKey
 * @param {'reg'|'all'} scope
 */
export function sortRivalries(list, sortKey = 'closest', scope = 'reg') {
    const rec = (r) => r?.[scope] || blankRecord();
    const key = (r) => pairKey(r.aId, r.bId);
    const arr = [...(list || [])];

    if (sortKey === 'meetings') {
        arr.sort(
            (a, b) =>
                rec(b).g - rec(a).g ||
                rivalryBalance(rec(b)) - rivalryBalance(rec(a)) ||
                key(a).localeCompare(key(b))
        );
    } else if (sortKey === 'lopsided') {
        arr.sort(
            (a, b) =>
                rivalryMargin(rec(b)) - rivalryMargin(rec(a)) ||
                rec(b).g - rec(a).g ||
                key(a).localeCompare(key(b))
        );
    } else {
        arr.sort(
            (a, b) =>
                rivalryBalance(rec(b)) - rivalryBalance(rec(a)) ||
                rec(b).g - rec(a).g ||
                key(a).localeCompare(key(b))
        );
    }
    return arr;
}
