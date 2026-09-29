import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTrendingPlayers } from '../../../utils/sleeper';

export const usePlayerNews = (roster, players) => {
    const { data: newsItems, isLoading, error, refetch: retry } = useQuery({
        queryKey: ['nflNews'],
        queryFn: async () => {
            // /api/news is a Vercel function. Vite alone serves index.html for
            // this path, which means there are no headlines to display locally.
            const res = await fetch('/api/news');
            if (!res.ok) {
                if (res.status === 404) return [];
                throw new Error('Failed to fetch news');
            }
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) return [];
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
        retry: false,
    });

    const { data: trendingDrops } = useQuery({
        queryKey: ['trendingDrops'],
        queryFn: () => fetchTrendingPlayers('drop', 24, 50),
        staleTime: 60 * 60 * 1000,
    });

    const { personalNews, topHeadlines } = useMemo(() => {
        const allNews = Array.isArray(newsItems) ? newsItems : [];
        const rosterPlayers = (roster?.players || []).map(id => players?.[id]).filter(Boolean);
        const playerNames = rosterPlayers.map(p =>
            `${p.first_name} ${p.last_name}`.replace(/\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '')
        );
        const drops = Array.isArray(trendingDrops) ? trendingDrops : [];

        const personalNews = allNews.filter(item =>
            typeof item?.title === 'string' && playerNames.some(name =>
                item.title.toLowerCase().includes(name.toLowerCase())
            )
        ).map(item => {
            const trendingDrop = drops.find(t => {
                const player = players?.[t.player_id];
                return player && item.title.includes(`${player.first_name} ${player.last_name}`);
            });
            return trendingDrop ? { ...item, trending: 'down', count: trendingDrop.count } : item;
        }).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        // Current injuries already appear in InjuryReport. Treating the first
        // time this browser sees a status as breaking news invents an event.
        return { personalNews, topHeadlines: allNews.slice(0, 3) };
    }, [newsItems, trendingDrops, roster, players]);

    return { personalNews, topHeadlines, isLoading, error, retry };
};
