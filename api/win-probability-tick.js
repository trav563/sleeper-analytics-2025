// Records win probabilities for tracked leagues, called every 5 minutes by
// Vercel cron (see vercel.json). With no games on it stops after one ESPN call,
// so the cost follows game time rather than the clock.
//
// Leagues run in batches 30 seconds apart within one invocation. That pacing,
// not the average rate, is what keeps a large run under Sleeper's 1000
// calls/minute guidance.
import { timingSafeEqual } from 'node:crypto';
import { espnScoreboardUrl, parseGameDetails } from '../src/lib/espnScoreboard.js';
import { gamePhase } from '../src/lib/liveProjection.js';
import { sampleLeagueProbabilities } from '../src/lib/winProbabilitySampler.js';
import { redisPipeline, sampleKey, LEAGUES_KEY, META_KEY, PLAYERS_KEY, LAST_LIVE_KEY, KEEPALIVE_KEY, TRACKING_WINDOW_MS } from './_redis.js';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
export const SAMPLE_INTERVAL_MS = 5 * 60_000;
export const BATCH_SIZE = 200;
export const BATCH_STAGGER_MS = 30_000; // 200 leagues per 30s = 400 Sleeper calls/minute at most.
const LEAGUE_CONCURRENCY = 8;
const PREGAME_MS = 10 * 60_000;
const POSTGAME_MS = 20 * 60_000; // Sleeper's final scores land a little after ESPN's final whistle.
const DELAYED_KICKOFF_MS = 60 * 60_000;
const SAMPLE_TTL_SECONDS = 180 * 86400; // Keeps a full season viewable.
const HOUR_MS = 3600_000;
const DAY_MS = 86400_000;
const MAX_RUN_MS = 280_000; // Stop cleanly before the 300s function limit.

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} from ${url}`);
    return res.json();
}

const fetchGames = async (week, season) => parseGameDetails(await fetchJSON(espnScoreboardUrl(week, season)));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** A live game, a kickoff within 10 minutes, or a game that was live moments ago. */
export function isSamplingWindow(games, now, lastLive) {
    return Object.values(games).some(game => {
        const phase = gamePhase(game);
        if (phase === 'LIVE') return true;
        const untilKickoff = Date.parse(game.kickoff) - now;
        return phase === 'SOON' && untilKickoff <= PREGAME_MS && untilKickoff >= -DELAYED_KICKOFF_MS;
    }) || now - lastLive <= POSTGAME_MS;
}

async function refreshPlayers() {
    // Sleeper asks that this 5 MB file is fetched at most daily, and the sampler
    // only needs each player's team and position.
    const all = await fetchJSON(`${SLEEPER_BASE}/players/nfl`);
    const players = {};
    for (const [id, p] of Object.entries(all)) {
        if (p?.team || p?.position === 'DEF') players[id] = { team: p.team, position: p.position };
    }
    await redisPipeline([['SET', PLAYERS_KEY, JSON.stringify(players), 'EX', '86400']]);
    return players;
}

async function sampleBatch({ leagueIds, season, week, at, players, rawProjections, games }) {
    const [metaRows] = await redisPipeline([['HMGET', META_KEY, ...leagueIds]]);
    const commands = [];
    let failed = 0;
    let next = 0;
    const worker = async () => {
        while (next < leagueIds.length) {
            const index = next++;
            const leagueId = leagueIds[index];
            const meta = metaRows[index] ? JSON.parse(metaRows[index]) : null;
            if (meta?.season !== season) continue;
            try {
                // Same 30-second CDN bust as the browser, or scores can lag the edge cache.
                const matchups = await fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${week}?_=${Math.floor(Date.now() / 30_000)}`);
                const sample = sampleLeagueProbabilities({ matchups, players, rawProjections, scoringSettings: meta.scoring, games });
                if (!Object.keys(sample).length) continue;
                const key = sampleKey(leagueId, season, week);
                // Field is the time bucket, so a repeated cron run overwrites instead of duplicating.
                commands.push(['HSET', key, String(at), JSON.stringify(sample)]);
                // Hourly is enough to set a TTL, and an EXPIRE per sample would double the Redis bill.
                if (at % HOUR_MS === 0) commands.push(['EXPIRE', key, String(SAMPLE_TTL_SECONDS)]);
            } catch (err) {
                failed++;
                console.warn(`[win-prob] league ${leagueId} skipped: ${err?.message}`);
            }
        }
    };
    await Promise.all(Array.from({ length: LEAGUE_CONCURRENCY }, worker));
    if (commands.length) await redisPipeline(commands);
    return failed;
}

export async function runSchedule({ now = Date.now(), wait = sleep } = {}) {
    // Upstash archives a free database nobody touches, which took AI analysis
    // down once. Nothing else writes in the offseason, so write once a day.
    if (now % DAY_MS < SAMPLE_INTERVAL_MS) await redisPipeline([['SET', KEEPALIVE_KEY, String(now)]]);

    const state = await fetchJSON(`${SLEEPER_BASE}/state/nfl`);
    if (state?.season_type !== 'regular') return { skipped: 'not regular season' };
    const season = String(state.season);
    const week = state.display_week ?? state.week;

    const firstGames = await fetchGames(week, season);
    const live = Object.values(firstGames).some(game => gamePhase(game) === 'LIVE');
    const [lastLive] = live ? [now] : await redisPipeline([['GET', LAST_LIVE_KEY]]);
    if (!isSamplingWindow(firstGames, now, Number(lastLive) || 0)) return { skipped: 'no games active' };

    const cutoff = now - TRACKING_WINDOW_MS;
    const [leagueIds, expired, cachedPlayers] = await redisPipeline([
        ['ZRANGEBYSCORE', LEAGUES_KEY, String(cutoff), '+inf'],
        ['ZRANGEBYSCORE', LEAGUES_KEY, '-inf', `(${cutoff}`],
        ['GET', PLAYERS_KEY],
        ...(live ? [['SET', LAST_LIVE_KEY, String(now)]] : []),
    ]);
    if (expired.length) await redisPipeline([['ZREM', LEAGUES_KEY, ...expired], ['HDEL', META_KEY, ...expired]]);
    if (!leagueIds.length) return { skipped: 'no tracked leagues' };

    const [players, rawProjections] = await Promise.all([
        cachedPlayers ? JSON.parse(cachedPlayers) : refreshPlayers(),
        fetchJSON(`${SLEEPER_BASE}/projections/nfl/regular/${season}/${week}`),
    ]);

    const at = Math.floor(now / SAMPLE_INTERVAL_MS) * SAMPLE_INTERVAL_MS;
    const started = Date.now();
    let failed = 0;
    let batches = 0;
    for (let i = 0; i < leagueIds.length; i += BATCH_SIZE, batches++) {
        if (batches > 0) {
            await wait(Math.max(0, batches * BATCH_STAGGER_MS - (Date.now() - started)));
            if (Date.now() - started > MAX_RUN_MS) {
                console.warn(`[win-prob] run stopped early, ${leagueIds.length - i} leagues not sampled`);
                break;
            }
        }
        // A later batch runs minutes after the first, so it needs its own game clocks.
        const games = batches === 0 ? firstGames : await fetchGames(week, season);
        failed += await sampleBatch({ leagueIds: leagueIds.slice(i, i + BATCH_SIZE), season, week, at, players, rawProjections, games });
    }
    return { leagues: leagueIds.length, batches, failed };
}

function authorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(String(req.headers?.authorization || ''));
    return expected.length === received.length && timingSafeEqual(expected, received);
}

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
        return res.status(200).json(await runSchedule());
    } catch (err) {
        console.error('[win-prob] tick failed:', err?.message);
        return res.status(500).json({ error: 'Tick failed' });
    }
}
