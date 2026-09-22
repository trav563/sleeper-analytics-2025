import { useMemo } from 'react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { leagueRecords } from '../../../utils/leagueRecords';

/** Composite is 25% each of normalized win%, PPG, all-play%, and schedule strength.
 * Callers supply only completed weeks; score magnitude cannot establish finality.
 */
export function computePowerRankings(seasonMatchups, rosters, users, league) {
    const weeksPlayed = Object.keys(seasonMatchups || {}).map(Number).filter(w => seasonMatchups[w]?.length && w >= (league?.settings?.start_week || 1) && w < (league?.settings?.playoff_week_start || 19)).sort((a, b) => a - b);
    if (!rosters?.length || !weeksPlayed.length) return { rankings: [], weeksPlayed: [], ranked: false };
    if (leagueRecords(rosters, seasonMatchups, league).some(t => !t.complete)) return { rankings: [], weeksPlayed, ranked: false, incomplete: true };
    const trends = Object.fromEntries(rosters.map(r => [r.roster_id, []]));
    let latest = [];
    for (const week of weeksPlayed) {
        const stats = leagueRecords(rosters, Object.fromEntries(Object.entries(seasonMatchups).filter(([w]) => Number(w) <= week)), league);
        if (stats.some(t => !t.complete)) return { rankings: [], weeksPlayed, ranked: false, incomplete: true };
        const ranges = Object.fromEntries(['winPct', 'ppg', 'apWinPct', 'sos'].map(key => {
            const values = stats.map(t => t[key]);
            return [key, { min: Math.min(...values), range: Math.max(...values) - Math.min(...values) }];
        }));
        latest = stats.map(t => ({ ...t, composite: Object.entries(ranges).reduce((n, [key, r]) => n + (r.range ? (t[key] - r.min) / r.range : 0) * 25, 0) }))
            .sort((a, b) => b.composite - a.composite || b.totalPoints - a.totalPoints);
        latest.forEach((t, i) => trends[t.rosterId].push({ week, rank: i + 1 }));
    }
    return { weeksPlayed, ranked: latest.some(t => t.gamesPlayed > 0), rankings: latest.map(t => {
        const owner = users?.find(u => u.user_id === rosters.find(r => r.roster_id === t.rosterId)?.owner_id);
        const trend = trends[t.rosterId], currentRank = trend.at(-1).rank, prevRank = trend.at(-2)?.rank ?? currentRank;
        return { ...t, ownerId: owner?.user_id, name: displayTeamName(owner), avatar: avatarUrl(owner?.avatar),
            pf: t.totalPoints, pa: t.opponentPoints, trend, currentRank, prevRank, rankChange: prevRank - currentRank };
    }) };
}
export const usePowerRankings = (seasonMatchups, rosters, users, league) => useMemo(() => computePowerRankings(seasonMatchups, rosters, users, league), [seasonMatchups, rosters, users, league]);
export default usePowerRankings;
