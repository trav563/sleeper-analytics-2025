import Parser from 'rss-parser';

const FEED_URL = 'https://fftoday.com/rss/news.xml';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Warm-instance cache. The edge cache keys on the full URL including the query
// string, so `?cb=<random>` bypasses it entirely — without this, a loop over
// unique query strings turns this endpoint into an unauthenticated amplifier
// pointed at fftoday.com, billed to us.
let cache = { data: null, time: 0 };
let inFlight = null;

async function loadFeed() {
    if (cache.data && Date.now() - cache.time < CACHE_TTL) return cache.data;
    // Collapse concurrent misses into a single upstream request.
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const parser = new Parser({ timeout: 8000 });
            const feed = await parser.parseURL(FEED_URL);
            const items = (feed.items || []).slice(0, 40).map(item => ({
                title: item.title,
                // Only ever hand the client an http(s) link — this text comes
                // from a third party and lands in an href.
                link: /^https?:\/\//i.test(item.link || '') ? item.link : null,
                content: item.content || item.contentSnippet,
                pubDate: item.pubDate,
            }));
            cache = { data: items, time: Date.now() };
            return items;
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
}

export default async function handler(req, res) {
    // HEAD too, or uptime monitors get a 405.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const items = await loadFeed();
        // Vary-free, query-independent payload: the response is identical for
        // every caller, so let the edge hold it for 10 minutes.
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=30');
        return res.status(200).json(items);
    } catch (error) {
        console.error('RSS Fetch Error:', error);
        // Serve stale rather than failing if we have anything at all.
        if (cache.data) {
            res.setHeader('Cache-Control', 's-maxage=60');
            return res.status(200).json(cache.data);
        }
        return res.status(502).json({ error: 'Failed to fetch news' });
    }
}
