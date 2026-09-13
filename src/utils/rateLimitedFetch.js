// Shared across queries in this browser tab. Avoid multiplying retries when an
// upstream provider asks us to back off; other provider origins remain usable.
const cooldowns = new Map();

function rateLimitError(retryAt) {
    const error = new Error('Data provider rate limit reached; updates will resume after the cooldown.');
    error.status = 429;
    error.retryAt = retryAt;
    return error;
}

export async function rateLimitedFetch(url, options) {
    const origin = new URL(url).origin;
    const now = Date.now();
    const until = cooldowns.get(origin) || 0;
    if (until > now) throw rateLimitError(until);
    const response = await fetch(url, options);
    if (response.status !== 429) return response;
    const header = response.headers.get('retry-after');
    const seconds = header?.trim() ? Number(header) : NaN;
    const parsedDate = header ? Date.parse(header) : NaN;
    const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000
        : Number.isFinite(parsedDate) && parsedDate > now ? parsedDate - now : 60_000;
    const retryAt = Date.now() + delay;
    cooldowns.set(origin, Math.max(cooldowns.get(origin) || 0, retryAt));
    throw rateLimitError(retryAt);
}
