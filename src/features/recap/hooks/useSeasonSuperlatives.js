import { assignLineup } from '../../../utils/lineupAssignment';
import { starterPoints } from '../../../lib/liveProjection';
import { useMemo } from 'react';
import { displayTeamName } from '../../../utils/nflData';
import { groupMatchups, buildOwnerLookup } from '../../../utils/leagueMath';


export function useSeasonSuperlatives(league, seasonMatchups, rosters, users, players) {
    return useMemo(() => {
        if (!league || !seasonMatchups || !rosters || !users || !players) return null;

        const weeks = Object.keys(seasonMatchups).map(Number).filter(w => seasonMatchups[w]?.length === rosters.length && seasonMatchups[w].every(m => Number.isFinite(m.points))).sort((a, b) => a - b);
        if (weeks.length < 3) return null; // Need at least 3 weeks

        const getUserForRoster = buildOwnerLookup(rosters, users);

        // Accumulators per manager (keyed by roster_id)
        const managerStats = {};
        const initManager = (rosterId) => {
            if (!managerStats[rosterId]) {
                const user = getUserForRoster(rosterId);
                managerStats[rosterId] = {
                    manager: displayTeamName(user),
                    avatar: user?.avatar,
                    robberyCount: 0,
                    totalBenchPoints: 0,
                    backpackCount: 0,
                    ghostCount: 0,
                    totalCoinFlipLost: 0,
                    luckyWins: 0,
                };
            }
        };

        // Global bests
        let seasonMVP = null; // highest single player score
        let seasonTank = null; // lowest team score

        weeks.forEach(week => {
            const matchups = [...seasonMatchups[week]].sort((a, b) => a.roster_id - b.roster_id);
            if (!matchups || matchups.length === 0) return;

            // Calculate median score for lucky wins
            const allScores = matchups.map(m => m.points).sort((a, b) => a - b);
            const median = allScores.length % 2 === 0
                ? (allScores[allScores.length / 2 - 1] + allScores[allScores.length / 2]) / 2
                : allScores[Math.floor(allScores.length / 2)];

            // --- Per-matchup analysis ---
            groupMatchups(matchups.filter(m => m.matchup_id != null)).forEach(group => {
                if (group.length !== 2) return;
                const [t1, t2] = group;
                const winner = t1.points > t2.points ? t1 : t2.points > t1.points ? t2 : null;
                const loser = t1.points > t2.points ? t2 : t2.points > t1.points ? t1 : null;

                if (!winner || !loser) return;

                initManager(winner.roster_id);
                initManager(loser.roster_id);

                // Most Robbed: loser who would have beaten most of the league
                const loserWinsAgainstField = allScores.filter(s => loser.points > s).length;
                const totalOpponents = allScores.length - 1;
                const percentile = totalOpponents > 0 ? (loserWinsAgainstField / totalOpponents) * 100 : 0;
                if (percentile >= 50) {
                    managerStats[loser.roster_id].robberyCount++;
                }

                // Lucky Wins: won with below-median score
                if (winner.points < median) {
                    managerStats[winner.roster_id].luckyWins++;
                }
            });

            // --- Per-team analysis ---
            matchups.forEach(m => {
                initManager(m.roster_id);
                const squadPoints = { ...m.players_points };
                (m.starters || []).forEach((pid, i) => { const pts = starterPoints(m, i); if (pid && pid !== '0' && Number.isFinite(pts)) squadPoints[pid] = pts; });

                // Season Tank: lowest team score
                if (Number.isFinite(m.points) && (!seasonTank || m.points < seasonTank.score)) {
                    seasonTank = {
                        manager: managerStats[m.roster_id].manager,
                        score: m.points,
                        week
                    };
                }

                // Boom Game / Season MVP: highest single player score
                (m.starters || []).forEach(pid => {
                    const pts = squadPoints[pid] || 0;
                    if (pts > 0 && players[pid] && (!seasonMVP || pts > seasonMVP.points)) {
                        seasonMVP = {
                            player: players[pid],
                            playerName: `${players[pid].first_name} ${players[pid].last_name}`,
                            points: pts.toFixed(2),
                            manager: managerStats[m.roster_id].manager,
                            week
                        };
                    }
                });

                // Ghost count: starters with 0
                (m.starters || []).forEach(pid => {
                    if (squadPoints[pid] === 0 && players[pid]) {
                        managerStats[m.roster_id].ghostCount++;
                    }
                });

                // Backpack: single player > 35% of team score
                if (m.points > 0) {
                    let bestStarterPts = 0;
                    (m.starters || []).forEach(pid => {
                        const pts = squadPoints[pid] || 0;
                        if (pts > bestStarterPts) bestStarterPts = pts;
                    });
                    if (bestStarterPts / m.points > 0.35) {
                        managerStats[m.roster_id].backpackCount++;
                    }
                }

                // Bench points (optimal - actual)
                if (league.roster_positions) {
                    const positions = league.roster_positions.filter(p => !['BN', 'IR', 'TAXI'].includes(p));
                    const starters = (m.starters || []).filter(pid => pid && pid !== '0');
                    const known = starters.every(pid => Number.isFinite(squadPoints[pid]));
                    const squad = (m.players || []).filter(pid => players[pid] && Number.isFinite(squadPoints[pid]))
                        .map(pid => ({ ...players[pid], id: pid, points: squadPoints[pid] }));
                    const starterTotal = starters.reduce((sum, pid) => sum + squadPoints[pid], 0);
                    const diff = known ? assignLineup(positions, squad, p => p.points).total - starterTotal : 0;
                    if (diff > 0) managerStats[m.roster_id].totalBenchPoints += diff;
                }

                // Coin flip: points lost from bad start/sit at same position
                const starters = (m.starters || []).map(pid => ({
                    id: pid,
                    points: squadPoints[pid],
                    pos: players[pid]?.fantasy_positions?.[0] || players[pid]?.position
                }));
                const bench = (m.players || [])
                    .filter(pid => !m.starters.includes(pid))
                    .map(pid => ({
                        id: pid,
                        points: squadPoints[pid],
                        pos: players[pid]?.fantasy_positions?.[0] || players[pid]?.position
                    }));

                starters.forEach(starter => {
                    if (!starter.pos || !Number.isFinite(starter.points)) return;
                    const betterOption = bench
                        .filter(b => b.pos === starter.pos && Number.isFinite(b.points) && b.points > starter.points)
                        .sort((a, b) => b.points - a.points)[0];
                    if (betterOption) {
                        managerStats[m.roster_id].totalCoinFlipLost += (betterOption.points - starter.points);
                    }
                });
            });
        });

        // Build results
        const managers = Object.values(managerStats);

        const findMax = (key) => {
            let best = null;
            managers.forEach(m => {
                if (!best || m[key] > best[key]) best = m;
            });
            return best && best[key] > 0 ? best : null;
        };

        const mostRobbed = findMax('robberyCount');
        const benchWarmer = findMax('totalBenchPoints');
        const backpackAllStar = findMax('backpackCount');
        const ghostHunter = findMax('ghostCount');
        const luckiestManager = findMax('luckyWins');

        // Coin flip champ
        const coinFlipChamp = findMax('totalCoinFlipLost');

        return {
            mostRobbed: mostRobbed ? { ...mostRobbed, count: mostRobbed.robberyCount } : null,
            benchWarmer: benchWarmer ? { ...benchWarmer, points: benchWarmer.totalBenchPoints.toFixed(1) } : null,
            backpackAllStar: backpackAllStar ? { ...backpackAllStar, count: backpackAllStar.backpackCount } : null,
            seasonMVP,
            seasonTank: seasonTank ? { ...seasonTank, score: seasonTank.score.toFixed(2) } : null,
            ghostHunter: ghostHunter ? { ...ghostHunter, count: ghostHunter.ghostCount } : null,
            coinFlipChamp: coinFlipChamp ? { ...coinFlipChamp, points: coinFlipChamp.totalCoinFlipLost.toFixed(1) } : null,
            luckiestManager: luckiestManager ? { ...luckiestManager, count: luckiestManager.luckyWins } : null,
            weeksAnalyzed: weeks.length,
        };
    }, [league, seasonMatchups, rosters, users, players]);
}
