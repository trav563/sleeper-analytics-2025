import { useQuery } from '@tanstack/react-query';

export const usePlayerNews = (rosterData, players) => {
    // 1. Fetch News (Filtered by Roster)
    const { data: newsItems, isLoading } = useQuery({
        queryKey: ['nflNews'],
        queryFn: async () => {
            // In development (npm run dev), /api/news won't exist unless using 'vercel dev'.
            // Fallback for purely local dev without Vercel CLI:
            if (import.meta.env.DEV && !window.location.host.includes('vercel.app')) {
                // If the fetch fails locally, we might want to return mock data or handle gracefully.
                // But let's try to fetch relative and let the error handling work if 404.
            }

            const res = await fetch('/api/news');
            if (!res.ok) {
                // Fallback for local dev if API route is 404
                if (res.status === 404) {
                    console.warn("News API not found (Local Dev). Functionality requires Vercel deployment.");
                    return [];
                }
                throw new Error('Failed to fetch news');
            }
            return res.json();
        },
        staleTime: 10 * 60 * 1000, // 10 minutes client cache
    });

    // 2. Filter Logic
    // We want to return { personalNews, topHeadlines }
    if (!newsItems || !rosterData || !players) {
        return {
            personalNews: [],
            topHeadlines: newsItems ? newsItems.slice(0, 3) : [],
            isLoading
        };
    }

    // Get user player names
    // Roster is simple array of player IDs? Or full objects?
    // Usually rosterData is the roster object with .players array of IDs
    const playerIds = rosterData.players || [];
    const myPlayerNames = playerIds.map(id => {
        const p = players[id];
        if (!p) return null;

        let fullName = `${p.first_name} ${p.last_name}`;

        // Remove suffixes for better matching logic (e.g. "Brian Thomas Jr." -> "Brian Thomas")
        // as news headlines often omit them ("Brian Thomas: ...")
        const cleanName = fullName.replace(/\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '');

        return cleanName;
    }).filter(Boolean);

    const personalNews = newsItems.filter(item => {
        return myPlayerNames.some(name => {
            // Case insensitive check
            return item.title.toLowerCase().includes(name.toLowerCase()) ||
                (item.content && item.content.toLowerCase().includes(name.toLowerCase()));
        });
    });

    return {
        personalNews,
        topHeadlines: newsItems.slice(0, 3), // Fallback content
        isLoading
    };
};
