// Upstash Redis over REST, plus the win-probability key layout shared by the
// sampler and the read endpoint. Underscore-prefixed so Vercel treats it as a
// module, not a route.
import { redisCredentials } from './_rateLimit.js';
import { WIN_PROBABILITY_MODEL } from '../src/lib/winProbability.js';

export async function redisPipeline(commands, { fetchImpl = fetch } = {}) {
    const { url, token } = redisCredentials();
    if (!url || !token) throw new Error('Redis not configured');
    const resp = await fetchImpl(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands),
    });
    if (!resp.ok) throw new Error(`Upstash ${resp.status}`);
    const results = await resp.json();
    const failed = results.find(r => r?.error);
    if (failed) throw new Error(`Upstash: ${failed.error}`);
    return results.map(r => r?.result);
}

export const LEAGUES_KEY = 'wp:leagues';
export const META_KEY = 'wp:meta';
export const PLAYERS_KEY = 'wp:players';
export const LAST_LIVE_KEY = 'wp:lastLive';
export const KEEPALIVE_KEY = 'wp:keepalive';
export const sampleKey = (leagueId, season, week) => `wp:${WIN_PROBABILITY_MODEL}:${leagueId}:${season}:${week}`;

/** A league keeps being sampled for this long after someone last opened it. */
export const TRACKING_WINDOW_MS = 30 * 86400_000;
