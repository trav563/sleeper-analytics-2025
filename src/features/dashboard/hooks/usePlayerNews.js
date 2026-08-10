import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTrendingPlayers } from '../../../utils/sleeper';

export const usePlayerNews = (roster, players) => {
    // 1. Fetch News (Filtered by Roster)
    const { data: newsItems } = useQuery({
        queryKey: ['nflNews'],
        queryFn: async () => {
            // /api/news is a Vercel serverless function. In `npm run dev` (Vite alone),
            // the route falls through to the SPA index.html instead of erroring, so we
            // detect non-JSON responses and treat them as "no news available" rather
            // than throwing. Use `vercel dev` locally for a live API.
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

    // 2. Fetch Trending Data (Drops)
    const { data: trendingDrops } = useQuery({
        queryKey: ['trendingDrops'],
        queryFn: () => fetchTrendingPlayers('drop', 24, 50), // Top 50 drops in 24h
        staleTime: 60 * 60 * 1000,
    });

    const result = useMemo(() => {
    if (!newsItems && !roster) {
        return { personalNews: [], topHeadlines: [], isLoading: true, updatedHistory: null };
    }

    // Process Roster Players
    const rosterPlayers = (roster?.players || []).map(id => players?.[id]).filter(Boolean);
    const myPlayerNames = rosterPlayers.map(p => {
        let fullName = `${p.first_name} ${p.last_name}`;
        // Strip suffixes
        return fullName.replace(/\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '');
    });

    // Strategy 1: Real News Matching
    let personalNews = (newsItems || []).filter(item => {
        return myPlayerNames.some(name => {
            return item.title.toLowerCase().includes(name.toLowerCase());
        });
    });

    // Strategy 2: Smart Alerts (Injuries with History Tracking)
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    // Load History
    let alertHistory = {};
    try {
        alertHistory = JSON.parse(localStorage.getItem('alert_history') || '{}');
    } catch (e) {
        console.warn('Failed to parse alert_history', e);
    }

    let historyUpdated = false;

    // Prune stale entries so alert_history can't grow forever.
    const THIRTY_DAYS = 30 * oneDay;
    Object.entries(alertHistory).forEach(([pid, rec]) => {
        if (!rec?.timestamp || now.getTime() - rec.timestamp > THIRTY_DAYS) {
            delete alertHistory[pid];
            historyUpdated = true;
        }
    });

    rosterPlayers.forEach(p => {
        // Only care about Bad Statuses, ignore Defenses
        if (p.position !== 'DEF' && (['IR', 'Out', 'PUP', 'Sus', 'Doubtful'].includes(p.status) || p.injury_status === 'Out')) {
            const displayStatus = p.injury_status || p.status;
            const pid = p.player_id;

            // Check History
            const lastRecord = alertHistory[pid];
            let alertTimestamp = lastRecord?.timestamp;

            // DETECT CHANGE (New Alert)
            if (!lastRecord || lastRecord.status !== displayStatus) {
                // Status Changed! Treat as NEW breaking news.
                alertTimestamp = now.getTime();

                // Update History
                alertHistory[pid] = {
                    status: displayStatus,
                    timestamp: alertTimestamp
                };
                historyUpdated = true;
            }

            // SHOW ALERT (If within 24h window of the "Change Event")
            if (now.getTime() - alertTimestamp < oneDay) {
                const name = `${p.first_name} ${p.last_name}`;
                personalNews.push({
                    title: `🚨 ALERT: ${name} is marked ${displayStatus}`,
                    link: null,
                    content: `Sleeper official status update: ${name} is currently ${displayStatus}.`,
                    pubDate: new Date(alertTimestamp).toISOString(),
                    type: 'alert',
                    player_id: pid
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
            const name = `${p.first_name} ${p.last_name}`;
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
        isLoading: !newsItems,
        updatedHistory: historyUpdated ? alertHistory : null,
    };
    }, [newsItems, trendingDrops, roster, players]);

    // Persist alert history outside render; best-effort (Safari private mode /
    // quota errors must not crash the dashboard).
    useEffect(() => {
        if (!result.updatedHistory) return;
        try {
            localStorage.setItem('alert_history', JSON.stringify(result.updatedHistory));
        } catch {
            // best-effort persistence only
        }
    }, [result]);

    return result;
};
