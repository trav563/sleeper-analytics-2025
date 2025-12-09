import Parser from 'rss-parser';

export default async function handler(req, res) {
    const parser = new Parser();

    try {
        // Fetch from FFToday
        const feed = await parser.parseURL('https://fftoday.com/rss/news.xml');

        // Cache Control: Cache for 10 minutes (600s), stale for 30s
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=30');

        // Return refined payload to minimize bandwidth
        const items = feed.items.map(item => ({
            title: item.title,
            link: item.link,
            content: item.content || item.contentSnippet,
            pubDate: item.pubDate
        }));

        res.status(200).json(items);
    } catch (error) {
        console.error('RSS Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
}
