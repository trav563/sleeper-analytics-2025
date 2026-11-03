// GET: a league week's recorded win probabilities. CDN-cached, so Redis reads
// scale with leagues rather than with how many people are viewing them.
// POST: marks a league as recently opened, which is what gets it sampled.
import { checkRateLimit, clientIp } from './_rateLimit.js';
import { redisPipeline, sampleKey, LEAGUES_KEY, META_KEY, TRACKING_WINDOW_MS } from './_redis.js';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
export const MAX_TRACKED_LEAGUES = 1800; // 9 batches, 30s apart, fit the sampler's 300s function limit.
const LEAGUE_ID = /^\d{1,30}$/;

async function readSamples(req, res) {
    const { leagueId, season, week: rawWeek } = req.query || {};
    const week = Number(rawWeek);
    if (!LEAGUE_ID.test(String(leagueId)) || !/^\d{4}$/.test(String(season)) || !Number.isInteger(week) || week < 1 || week > 18) {
        return res.status(400).json({ error: 'Missing or invalid required fields' });
    }
    const [flat] = await redisPipeline([['HGETALL', sampleKey(leagueId, season, week)]]);
    const samples = [];
    for (let i = 0; i + 1 < (flat?.length || 0); i += 2) samples.push({ at: Number(flat[i]), p: JSON.parse(flat[i + 1]) });
    samples.sort((a, b) => a.at - b.at);
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ samples });
}

async function trackLeague(req, res) {
    const { leagueId } = req.body || {};
    if (typeof leagueId !== 'string' || !LEAGUE_ID.test(leagueId)) return res.status(400).json({ error: 'Invalid league' });

    // Separate quota from AI analysis: the prefix gives it its own counters.
    const rateCheck = await checkRateLimit(`wp:${clientIp(req)}`);
    if (!rateCheck.allowed) return res.status(rateCheck.unavailable ? 503 : 429).json({ error: rateCheck.reason });

    const [leagueRes, stateRes] = await Promise.all([fetch(`${SLEEPER_BASE}/league/${leagueId}`), fetch(`${SLEEPER_BASE}/state/nfl`)]);
    if (!leagueRes.ok || !stateRes.ok) throw new Error(`Sleeper ${leagueRes.status}/${stateRes.status}`);
    const [league, state] = await Promise.all([leagueRes.json(), stateRes.json()]);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.sport !== 'nfl' || String(league.season) !== String(state?.season)) return res.status(200).json({ tracked: false });

    const now = Date.now();
    const [existing, active] = await redisPipeline([
        ['ZSCORE', LEAGUES_KEY, leagueId],
        ['ZCOUNT', LEAGUES_KEY, String(now - TRACKING_WINDOW_MS), '+inf'],
    ]);
    if (existing == null && active >= MAX_TRACKED_LEAGUES) {
        console.warn('[win-prob] tracked league cap reached');
        return res.status(200).json({ tracked: false });
    }
    await redisPipeline([
        ['ZADD', LEAGUES_KEY, String(now), leagueId],
        ['HSET', META_KEY, leagueId, JSON.stringify({ season: String(league.season), scoring: league.scoring_settings || {} })],
    ]);
    return res.status(200).json({ tracked: true });
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        return await (req.method === 'GET' ? readSamples(req, res) : trackLeague(req, res));
    } catch (err) {
        console.error('[win-prob] request failed:', err?.message);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(503).json({ error: 'Win probability history is temporarily unavailable.' });
    }
}
