import { useMemo } from 'react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';

/**
 * Composite power rankings + per-week rank history derived from a season's
 * matchup data. Returns:
 *   {
 *     rankings: [{
 *       rosterId, ownerId, name, avatar,
 *       record, ppg, apWinPct, sos, pf, pa,
 *       trend: [{ week, rank }],
 *       currentRank, prevRank, rankChange,
 *       composite,
 *     }, ...],   // sorted by currentRank ascending
 *     weeksPlayed: [1, 2, ...]
 *   }
 *
 * Composite = 25% winPct + 25% PPG + 25% all-play% + 25% strength of schedule.
 * Empty arrays / object when there's no data.
 */
export const usePowerRankings = (seasonMatchups, rosters, users) => {
    return useMemo(() => {
        if (!seasonMatchups || !rosters || Object.keys(seasonMatchups).length === 0) {
            return { rankings: [], weeksPlayed: [] };
        }

        const weeksPlayed = Object.keys(seasonMatchups)
            .map(Number)
            .sort((a, b) => a - b);
        if (weeksPlayed.length === 0) return { rankings: [], weeksPlayed: [] };

        const lastWeek = weeksPlayed[weeksPlayed.length - 1];
        const weeklyRankings = {}; // rosterId -> [rank per week]
        rosters.forEach((r) => { weeklyRankings[r.roster_id] = []; });

        // Re-rank for each accumulated week 1..lastWeek so we have trend data.
        for (let upToWeek = 1; upToWeek <= lastWeek; upToWeek++) {
            const teamScores = {};
            rosters.forEach((r) => {
                teamScores[r.roster_id] = {
                    rosterId: r.roster_id,
                    wins: 0, losses: 0, ties: 0,
                    totalPoints: 0, gamesPlayed: 0,
                    allPlayWins: 0, allPlayLosses: 0,
                    opponentPoints: 0,
                };
            });

            for (let w = 1; w <= upToWeek; w++) {
                const wkData = seasonMatchups[w];
                if (!Array.isArray(wkData)) continue;
                const allScores = wkData.map((m) => ({ rosterId: m.roster_id, points: m.points || 0 }));

                // Win/loss from grouped matchups.
                const groups = {};
                wkData.forEach((m) => {
                    if (!groups[m.matchup_id]) groups[m.matchup_id] = [];
                    groups[m.matchup_id].push(m);
                });
                Object.values(groups).forEach((g) => {
                    if (g.length !== 2) return;
                    const [a, b] = g;
                    if (a.points > b.points) {
                        if (teamScores[a.roster_id]) teamScores[a.roster_id].wins++;
                        if (teamScores[b.roster_id]) teamScores[b.roster_id].losses++;
                    } else if (b.points > a.points) {
                        if (teamScores[b.roster_id]) teamScores[b.roster_id].wins++;
                        if (teamScores[a.roster_id]) teamScores[a.roster_id].losses++;
                    } else if (a.points || b.points) {
                        if (teamScores[a.roster_id]) teamScores[a.roster_id].ties++;
                        if (teamScores[b.roster_id]) teamScores[b.roster_id].ties++;
                    }
                    if (teamScores[a.roster_id]) teamScores[a.roster_id].opponentPoints += b.points || 0;
                    if (teamScores[b.roster_id]) teamScores[b.roster_id].opponentPoints += a.points || 0;
                });

                // Points + games.
                allScores.forEach(({ rosterId, points }) => {
                    if (teamScores[rosterId] && points > 0) {
                        teamScores[rosterId].totalPoints += points;
                        teamScores[rosterId].gamesPlayed++;
                    }
                });

                // All-play.
                allScores.forEach((teamA) => {
                    allScores.forEach((teamB) => {
                        if (teamA.rosterId === teamB.rosterId) return;
                        if (teamA.points > teamB.points && teamScores[teamA.rosterId]) {
                            teamScores[teamA.rosterId].allPlayWins++;
                        } else if (teamA.points < teamB.points && teamScores[teamA.rosterId]) {
                            teamScores[teamA.rosterId].allPlayLosses++;
                        }
                    });
                });
            }

            // Per-week composite + sort.
            const scored = Object.values(teamScores).map((t) => {
                const gp = t.gamesPlayed || 1;
                const totalGames = t.wins + t.losses + t.ties || 1;
                const winPct = (t.wins + t.ties * 0.5) / totalGames;
                const ppg = t.totalPoints / gp;
                const apTotal = t.allPlayWins + t.allPlayLosses || 1;
                const apWinPct = t.allPlayWins / apTotal;
                const sos = t.opponentPoints / gp;
                return { ...t, winPct, ppg, apWinPct, sos };
            });
            const normalize = (arr, key) => {
                const vals = arr.map((a) => a[key]);
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const range = max - min || 1;
                return arr.map((a) => ({ ...a, [`${key}Norm`]: (a[key] - min) / range }));
            };
            let ranked = scored;
            ranked = normalize(ranked, 'winPct');
            ranked = normalize(ranked, 'ppg');
            ranked = normalize(ranked, 'apWinPct');
            ranked = normalize(ranked, 'sos');
            ranked.forEach((t) => {
                t.composite = (t.winPctNorm * 0.25 + t.ppgNorm * 0.25 + t.apWinPctNorm * 0.25 + t.sosNorm * 0.25) * 100;
            });
            ranked.sort((a, b) => b.composite - a.composite || b.totalPoints - a.totalPoints);
            ranked.forEach((t, i) => weeklyRankings[t.rosterId].push(i + 1));
        }

        // Build the final rankings list using the latest accumulated stats.
        const finalScores = {};
        rosters.forEach((r) => {
            finalScores[r.roster_id] = {
                rosterId: r.roster_id,
                wins: 0, losses: 0, ties: 0,
                totalPoints: 0, opponentPoints: 0, gamesPlayed: 0,
                allPlayWins: 0, allPlayLosses: 0,
            };
        });
        for (let w = 1; w <= lastWeek; w++) {
            const wkData = seasonMatchups[w];
            if (!Array.isArray(wkData)) continue;
            const allScores = wkData.map((m) => ({ rosterId: m.roster_id, points: m.points || 0 }));
            const groups = {};
            wkData.forEach((m) => {
                if (!groups[m.matchup_id]) groups[m.matchup_id] = [];
                groups[m.matchup_id].push(m);
            });
            Object.values(groups).forEach((g) => {
                if (g.length !== 2) return;
                const [a, b] = g;
                if (a.points > b.points) {
                    if (finalScores[a.roster_id]) finalScores[a.roster_id].wins++;
                    if (finalScores[b.roster_id]) finalScores[b.roster_id].losses++;
                } else if (b.points > a.points) {
                    if (finalScores[b.roster_id]) finalScores[b.roster_id].wins++;
                    if (finalScores[a.roster_id]) finalScores[a.roster_id].losses++;
                }
                if (finalScores[a.roster_id]) finalScores[a.roster_id].opponentPoints += b.points || 0;
                if (finalScores[b.roster_id]) finalScores[b.roster_id].opponentPoints += a.points || 0;
            });
            allScores.forEach(({ rosterId, points }) => {
                if (finalScores[rosterId] && points > 0) {
                    finalScores[rosterId].totalPoints += points;
                    finalScores[rosterId].gamesPlayed++;
                }
            });
            allScores.forEach((teamA) => {
                allScores.forEach((teamB) => {
                    if (teamA.rosterId === teamB.rosterId) return;
                    if (teamA.points > teamB.points && finalScores[teamA.rosterId]) {
                        finalScores[teamA.rosterId].allPlayWins++;
                    } else if (teamA.points < teamB.points && finalScores[teamA.rosterId]) {
                        finalScores[teamA.rosterId].allPlayLosses++;
                    }
                });
            });
        }

        const rankings = Object.values(finalScores).map((t) => {
            const gp = t.gamesPlayed || 1;
            const ppg = t.totalPoints / gp;
            const apTotal = t.allPlayWins + t.allPlayLosses || 1;
            const apWinPct = t.allPlayWins / apTotal;
            const sos = t.opponentPoints / gp;
            const owner = users?.find((u) => u.user_id === rosters.find((r) => r.roster_id === t.rosterId)?.owner_id);
            const trend = (weeklyRankings[t.rosterId] || []).map((rank, i) => ({ week: i + 1, rank }));
            const currentRank = trend.length ? trend[trend.length - 1].rank : rosters.length;
            const prevRank = trend.length > 1 ? trend[trend.length - 2].rank : currentRank;
            return {
                rosterId: t.rosterId,
                ownerId: owner?.user_id,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar),
                record: `${t.wins}-${t.losses}${t.ties > 0 ? `-${t.ties}` : ''}`,
                wins: t.wins,
                losses: t.losses,
                pf: t.totalPoints,
                pa: t.opponentPoints,
                ppg,
                apWinPct,
                sos,
                allPlayWins: t.allPlayWins,
                allPlayLosses: t.allPlayLosses,
                trend,
                currentRank,
                prevRank,
                rankChange: prevRank - currentRank,
            };
        }).sort((a, b) => a.currentRank - b.currentRank);

        return { rankings, weeksPlayed };
    }, [seasonMatchups, rosters, users]);
};

export default usePowerRankings;
