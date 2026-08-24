// Fixed-window rate limiting for the AI endpoint.
//
// Underscore-prefixed so Vercel treats it as a module, not a route.
//
// Durable counters live in Upstash Redis over REST. REST matters here: a
// traditional Redis connection would be opened per lambda instance, so Vercel
// scaling out under load exhausts the connection pool exactly when you need it
// most. Stateless HTTP has no pool to exhaust.
//
// This endpoint spends real money on every call, so it fails CLOSED when Redis
// is unavailable rather than falling back to a per-instance counter — that
// fallback's effective quota GROWS as Vercel scales out, which is the opposite
// of a limit.

export const RATE_LIMIT_PER_DAY = 30;
export const RATE_LIMIT_PER_HOUR = 10;

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/**
 * Per-instance memory of clients already known to be over quota.
 *
 * This is safe in a way an in-memory *limiter* is not, because it can only
 * ever DENY. A miss falls through to Redis, which stays authoritative, so the
 * worst case is that it does nothing. It can never hand out quota.
 *
 * It exists for cost, not correctness: without it, a client hammering the
 * endpoint after being blocked still burns 4 Redis commands per request, so
 * an abuser who ignores their 429s drives unbounded Upstash spend. With it,
 * they cost one lookup until their window rolls over.
 */
const denyUntil = new Map();
const DENY_CACHE_MAX = 10000;

/** Start of the next fixed window, so a denial expires exactly when quota resets. */
const nextWindowStart = (now, windowMs) => (Math.floor(now / windowMs) + 1) * windowMs;

function remember(clientKey, until, result) {
    if (denyUntil.size >= DENY_CACHE_MAX) {
        const now = Date.now();
        for (const [k, v] of denyUntil) {
            if (v.until <= now) denyUntil.delete(k);
        }
        // Still full of live entries? Drop oldest-inserted (Map keeps order).
        while (denyUntil.size >= DENY_CACHE_MAX) {
            const oldest = denyUntil.keys().next().value;
            if (oldest === undefined) break;
            denyUntil.delete(oldest);
        }
    }
    denyUntil.set(clientKey, { until, result });
}

/** Test seam — the deny cache is module state that outlives a single test. */
export function _resetDenyCache() {
    denyUntil.clear();
}

/**
 * Resolve the Redis REST credentials.
 *
 * Vercel's Upstash marketplace integration injects the KV_REST_API_* names;
 * a hand-configured Upstash database uses UPSTASH_REDIS_REST_*. Accept either
 * so the endpoint works however it was provisioned, rather than requiring the
 * same secret to be duplicated under a second name.
 *
 * Deliberately NOT KV_REST_API_READ_ONLY_TOKEN: INCR and EXPIRE are writes, so
 * the read-only token would fail every call — and because we fail closed, that
 * looks exactly like an outage. KV_URL / REDIS_URL are the TCP protocol URLs
 * and don't speak REST.
 */
export function redisCredentials(env = process.env) {
    return {
        url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || '',
        token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '',
    };
}

/**
 * @param {string} clientKey  IP address. Never include user-supplied identity:
 *   keying on anything the caller controls multiplies quota instead of
 *   limiting it, since they can just rotate the value.
 */
export async function checkRateLimit(clientKey, { fetchImpl = fetch, now = Date.now() } = {}) {
    const cached = denyUntil.get(clientKey);
    if (cached) {
        if (cached.until > now) return cached.result;
        denyUntil.delete(clientKey);
    }

    const { url, token } = redisCredentials();
    if (!url || !token) {
        console.error('[rate-limit] Upstash not configured — refusing request');
        return { allowed: false, reason: 'AI analysis is temporarily unavailable.', remaining: 0, unavailable: true };
    }

    try {
        const hourKey = `rl:h:${clientKey}:${Math.floor(now / HOUR_MS)}`;
        const dayKey = `rl:d:${clientKey}:${Math.floor(now / DAY_MS)}`;
        const resp = await fetchImpl(`${url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([
                ['INCR', hourKey], ['EXPIRE', hourKey, '3600'],
                ['INCR', dayKey], ['EXPIRE', dayKey, '86400'],
            ]),
        });
        if (!resp.ok) throw new Error(`Upstash ${resp.status}`);
        const results = await resp.json();
        const hourly = Number(results[0]?.result ?? 0);
        const daily = Number(results[2]?.result ?? 0);
        const remaining = Math.max(0, RATE_LIMIT_PER_DAY - daily);

        if (daily >= RATE_LIMIT_PER_DAY) {
            const result = { allowed: false, reason: `Daily limit reached (${RATE_LIMIT_PER_DAY}/day). Try again tomorrow.`, remaining: 0 };
            remember(clientKey, nextWindowStart(now, DAY_MS), result);
            return result;
        }
        if (hourly >= RATE_LIMIT_PER_HOUR) {
            const result = { allowed: false, reason: `Hourly limit reached (${RATE_LIMIT_PER_HOUR}/hour). Try again shortly.`, remaining };
            remember(clientKey, nextWindowStart(now, HOUR_MS), result);
            return result;
        }
        return { allowed: true, remaining };
    } catch (err) {
        // Fail closed on a Redis error too — otherwise an attacker who can make
        // Upstash flap gets an unlimited path for free. Deliberately NOT cached:
        // a transient outage must not lock a client out for the whole window.
        console.error('[rate-limit] Upstash unavailable — refusing request:', err?.message);
        return { allowed: false, reason: 'AI analysis is temporarily unavailable.', remaining: 0, unavailable: true };
    }
}

/**
 * Trusted client IP.
 *
 * `x-vercel-forwarded-for` is set by Vercel's edge and can't be spoofed by the
 * caller. Plain `x-forwarded-for` can: a client sends its own header and the
 * proxy appends, so the LEFTMOST entry is attacker-controlled and the rightmost
 * is the one our infrastructure added.
 */
export function clientIp(req) {
    const vercel = String(req.headers?.['x-vercel-forwarded-for'] || '').trim();
    if (vercel) return vercel;
    const xff = String(req.headers?.['x-forwarded-for'] || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    return xff[xff.length - 1] || req.socket?.remoteAddress || 'unknown';
}
