```javascript
import { useQuery } from '@tanstack/react-query';
import { fetchTrendingPlayers } from '../../../utils/sleeper';

export const usePlayerNews = (roster, players) => {
    // 1. Fetch News (Filtered by Roster)
    const { data: newsItems } = useQuery({
        queryKey: ['nflNews'],
        queryFn: async () => {
            // In development (npm run dev), /api/news won't exist unless using 'vercel dev'.
            if (import.meta.env.DEV && !window.location.host.includes('vercel.app')) {
                 // Fallback or mock could go here. For now we try relative.
            }
            
            const res = await fetch('/api/news');
            if (!res.ok) {
                 if (res.status === 404) return [];
                 throw new Error('Failed to fetch news');
            }
            return res.json();
        },
        staleTime: 10 * 60 * 1000, 
    });

    // 2. Fetch Trending Data (Drops)
    const { data: trendingDrops } = useQuery({
        queryKey: ['trendingDrops'],
        queryFn: () => fetchTrendingPlayers('drop', 24, 50), // Top 50 drops in 24h
        staleTime: 60 * 60 * 1000, 
    });

    if (!newsItems && !roster) {
        return { personalNews: [], topHeadlines: [], isLoading: true };
    }

    // Process Roster Players
    const rosterPlayers = (roster?.players || []).map(id => players?.[id]).filter(Boolean);
    const myPlayerNames = rosterPlayers.map(p => {
        let fullName = `${ p.first_name } ${ p.last_name } `;
        // Strip suffixes
        return fullName.replace(/\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '');
    });

    // Strategy 1: Real News Matching
    let personalNews = (newsItems || []).filter(item => {
        return myPlayerNames.some(name => {
            return item.title.toLowerCase().includes(name.toLowerCase()) || 
                   (item.content && item.content.toLowerCase().includes(name.toLowerCase()));
        });
    });

    // Strategy 2: Synthetic Alerts (Injuries)
    // If player is injured, and NO news in last 24h, create alert.
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    rosterPlayers.forEach(p => {
        // Check for major statuses
        if (['IR', 'Out', 'PUP', 'Sus', 'Doubtful'].includes(p.status) || p.injury_status === 'Out') {
            const name = `${ p.first_name } ${ p.last_name } `;
            // Check if we already have recent news for this player
            const hasRecentNews = personalNews.some(n => {
                const nDate = new Date(n.pubDate);
                return (now - nDate < oneDay) && n.title.includes(name);
            });

            if (!hasRecentNews) {
                personalNews.push({
                    title: `🚨 ALERT: ${ name } is marked ${ p.status || p.injury_status } `,
                    link: null, // No link for synthetic
                    content: `Sleeper official status update: ${ name } is currently ${ p.status || p.injury_status }.`,
                    pubDate: new Date().toISOString(), // effectively "now"
                    type: 'alert',
                    player_id: p.player_id
                });
            }
        }
    });

    // Strategy 3: Trending Context
    // Tag news items if the player is also trending down
    personalNews = personalNews.map(item => {
        // Find if any player in this news item is trending down
        const trendingDrop = trendingDrops?.find(t => {
            const p = players?.[t.player_id];
            if (!p) return false;
            const name = `${ p.first_name } ${ p.last_name } `;
            return item.title.includes(name);
        });

        if (trendingDrop) {
            return { ...item, trending: 'down', count: trendingDrop.count };
        }
        return item;
    });

    // Sort by Date (incorporating synthetic alerts which are "now")
    personalNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    return {
        personalNews,
        topHeadlines: (newsItems || []).slice(0, 3),
        isLoading: !newsItems
    };
};
```
