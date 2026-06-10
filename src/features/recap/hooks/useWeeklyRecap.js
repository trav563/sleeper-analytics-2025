import { useMemo } from 'react';
import { displayTeamName } from '../../../utils/nflData';

export function useWeeklyRecap(league, matchups, rosters, users, players, currentWeek) {
    const recapWeek = currentWeek > 1 ? currentWeek - 1 : 1; // Default to week 1 if current is 1, though usually we want prev week
    // Ideally if currentWeek is 1 and season hasn't started, we show nothing. 
    // If season is over, we show last week.
    // For now, let's just stick to currentWeek - 1, and if < 1, return null. But for testing, let's allow week 1 if needed or handle logic.
    // Actually, safer to just target 'week' passed in if we want flexibility, but requirement said 'previous completed week'.
    // Let's assume we pass the *target* week to this hook, or we handle the -1 inside.

    // Let's rely on the caller to pass the specific week data (matchups), so we just process what we get.
    // But we need to know WHICH week it is for context.

    const analysis = useMemo(() => {
        if (!league || !matchups || matchups.length === 0 || !players || !rosters) return null;

        // 1. "The Robbery" (Bad Luck)
        // Find loser with highest score
        let robbery = null;

        // Map matchups to get all scores for percentile calc
        const allScores = matchups.map(m => m.points).sort((a, b) => a - b);

        // Group by match_id to identify winners/losers
        const matchGroups = {};
        matchups.forEach(m => {
            if (!matchGroups[m.matchup_id]) matchGroups[m.matchup_id] = [];
            matchGroups[m.matchup_id].push(m);
        });

        let highestLoserScore = -1;
        let unluckyTeam = null;
        let luckOpponent = null;

        Object.values(matchGroups).forEach(group => {
            if (group.length !== 2) return;
            const [t1, t2] = group;
            const loser = t1.points < t2.points ? t1 : t2.points < t1.points ? t2 : null;
            const winner = t1.points > t2.points ? t1 : t2.points > t1.points ? t2 : null;

            if (loser) {
                if (loser.points > highestLoserScore) {
                    highestLoserScore = loser.points;
                    unluckyTeam = loser;
                    luckOpponent = winner;
                }
            }
        });

        if (unluckyTeam) {
            // Calculate wins against field
            const winsAgainstField = allScores.filter(s => unluckyTeam.points > s).length;
            const totalOpponents = allScores.length - 1; // Exclude self
            // Note: allScores includes self, so filtering > s works. If duplicate scores, strict > is correct for "beaten".

            const percentile = (winsAgainstField / totalOpponents) * 100;

            // THRESHOLD CHECK: Must better than 70% of the league
            if (percentile >= 70) {
                const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === unluckyTeam.roster_id)?.owner_id);
                const oppUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === luckOpponent.roster_id)?.owner_id);

                robbery = {
                    manager: displayTeamName(user),
                    avatar: user?.avatar,
                    score: unluckyTeam.points.toFixed(2),
                    opponent: displayTeamName(oppUser),
                    wins: winsAgainstField,
                    total: totalOpponents,
                    percentile: Math.round(percentile)
                };
            }
        }

        // Fallback: Dynamic Matchup Highlight (if no Robbery)
        // Priorities: 1. Struggle (<95 pts), 2. Close (<6 pts), 3. Blowout (Max Margin)
        let matchupHighlight = null;
        if (!robbery) {
            let struggleMatch = null;
            let minWinScore = 999;

            let closeMatch = null;
            let minMargin = 999;

            let blowoutMatch = null;
            let maxMargin = -1;

            Object.values(matchGroups).forEach(group => {
                if (group.length !== 2) return;
                const [t1, t2] = group;

                const winner = t1.points > t2.points ? t1 : t2;
                const loser = t1.points > t2.points ? t2 : t1;
                const margin = winner.points - loser.points;

                // Check Priorities locally

                // 1. Struggle (Low Win Score)
                if (winner.points < minWinScore) {
                    minWinScore = winner.points;
                    struggleMatch = { winner, loser, score: winner.points, margin };
                }

                // 2. Close (Low Margin)
                if (margin < minMargin) {
                    minMargin = margin;
                    closeMatch = { winner, loser, score: winner.points, margin };
                }

                // 3. Blowout (High Margin)
                if (margin > maxMargin) {
                    maxMargin = margin;
                    blowoutMatch = { winner, loser, score: winner.points, margin };
                }
            });

            // DECISION TIME
            // Thresholds
            const LOW_SCORE_THRESHOLD = 95;
            const CLOSE_GAME_THRESHOLD = 6;

            if (struggleMatch && struggleMatch.score < LOW_SCORE_THRESHOLD) {
                // Priority 1: Struggle
                const wUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === struggleMatch.winner.roster_id)?.owner_id);
                const lUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === struggleMatch.loser.roster_id)?.owner_id);
                matchupHighlight = {
                    type: 'STRUGGLE',
                    title: 'The Struggle Bus',
                    winner: displayTeamName(wUser),
                    loser: displayTeamName(lUser),
                    score: struggleMatch.score.toFixed(2),
                    margin: struggleMatch.margin.toFixed(2)
                };
            } else if (closeMatch && closeMatch.margin < CLOSE_GAME_THRESHOLD) {
                // Priority 2: Heart Attack
                const wUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === closeMatch.winner.roster_id)?.owner_id);
                const lUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === closeMatch.loser.roster_id)?.owner_id);
                matchupHighlight = {
                    type: 'CLOSE',
                    title: 'The Heart Attack',
                    winner: displayTeamName(wUser),
                    loser: displayTeamName(lUser),
                    score: closeMatch.score.toFixed(2),
                    margin: closeMatch.margin.toFixed(2)
                };
            } else if (blowoutMatch) {
                // Priority 3: Beatdown
                const wUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === blowoutMatch.winner.roster_id)?.owner_id);
                const lUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === blowoutMatch.loser.roster_id)?.owner_id);
                matchupHighlight = {
                    type: 'BLOWOUT',
                    title: 'The Beatdown',
                    winner: displayTeamName(wUser),
                    loser: displayTeamName(lUser),
                    score: blowoutMatch.score.toFixed(2),
                    margin: blowoutMatch.margin.toFixed(2)
                };
            }
        }

        // 2. "The Dynasty Flex" (Top Rookie)
        let topRookie = null;
        let maxRookiePoints = -1;

        matchups.forEach(m => {
            // Check starters
            (m.starters || []).forEach((playerId, index) => {
                const player = players[playerId];
                const points = m.starters_points[index];
                // Check if rookie (years_exp is 0). 
                // Note: Sleeper updates years_exp. 0 = Rookie.
                if (player && player.years_exp === 0) {
                    if (points > maxRookiePoints) {
                        maxRookiePoints = points;
                        const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === m.roster_id)?.owner_id);
                        topRookie = {
                            player: player,
                            points: points.toFixed(2),
                            manager: displayTeamName(user)
                        };
                    }
                }
            });
            // Also check bench? Requirement says "highest scoring rookie". Usually implies starters + bench.
            // Matchup object has 'players' array (all players) but 'players_points' is map.
            // Let's check full squad. 
            if (m.players) {
                m.players.forEach(playerId => {
                    if (!m.starters.includes(playerId)) {
                        const player = players[playerId];
                        const points = m.players_points[playerId] || 0;
                        if (player && player.years_exp === 0) {
                            if (points > maxRookiePoints) {
                                maxRookiePoints = points;
                                const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === m.roster_id)?.owner_id);
                                topRookie = {
                                    player: player,
                                    points: points.toFixed(2),
                                    manager: displayTeamName(user),
                                    isBench: true // Mark if it was a bench performance
                                };
                            }
                        }
                    }
                })
            }
        });


        // 3. "Manager Malpractice" (Lineup Efficiency)
        let worstManager = null;
        let maxDiff = -1;

        matchups.forEach(m => {
            // Calculate Optimal Score
            // We need roster positions from league settings
            const positions = league.roster_positions.filter(p => p !== 'BN'); // Exclude Bench slots

            // Get all players and their points
            const squad = (m.players || []).map(pid => ({
                id: pid,
                points: m.players_points[pid] || 0,
                position: players[pid]?.fantasy_positions?.[0] // Primary pos
            })).sort((a, b) => b.points - a.points); // Sort by points desc

            // Simple Greedy Solver
            let optimalPoints = 0;
            const usedPlayers = new Set();

            // Helper to find best available valid player for a slot
            const fillSlot = (posType) => {
                const validPlayer = squad.find(p => !usedPlayers.has(p.id) && isValidPosition(p.position, posType));
                if (validPlayer) {
                    usedPlayers.add(validPlayer.id);
                    optimalPoints += validPlayer.points;
                    return validPlayer;
                }
                return null;
            };

            positions.forEach(pos => fillSlot(pos));

            const actualPoints = m.points;
            const diff = optimalPoints - actualPoints;

            if (diff > maxDiff) {
                maxDiff = diff;
                // Find bench player with most points
                const bench = squad.filter(p => !m.starters.includes(p.id));
                const bestBench = bench.length > 0 ? bench[0] : null; // Already sorted desc

                if (bestBench) {
                    const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === m.roster_id)?.owner_id);
                    const playerObj = players[bestBench.id];
                    worstManager = {
                        manager: displayTeamName(user),
                        avatar: user?.avatar,
                        diff: diff.toFixed(2),
                        actual: actualPoints.toFixed(2),
                        optimal: optimalPoints.toFixed(2),
                        benchPlayer: playerObj,
                        benchPoints: bestBench.points.toFixed(2)
                    };
                }
            }
        });

        // 4. "The Backpack Award" (Carry Job)
        let bagCarrier = null;
        let maxCarryRatio = -1;

        matchups.forEach(m => {
            if (m.points <= 0) return;
            const squadPoints = m.players_points || {};
            let bestPlayerId = null;
            let bestPlayerPoints = -1;

            (m.starters || []).forEach(pid => {
                const pts = squadPoints[pid] || 0;
                if (pts > bestPlayerPoints) {
                    bestPlayerPoints = pts;
                    bestPlayerId = pid;
                }
            });

            if (bestPlayerId) {
                const ratio = bestPlayerPoints / m.points;
                if (ratio > maxCarryRatio) {
                    maxCarryRatio = ratio;
                    const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === m.roster_id)?.owner_id);
                    bagCarrier = {
                        manager: displayTeamName(user),
                        player: players[bestPlayerId],
                        points: bestPlayerPoints.toFixed(2),
                        percentage: Math.round(ratio * 100)
                    };
                }
            }
        });

        // 5. "The Coin Flip Fail" (Start/Sit Regret - Same Position)
        let coinFlipFail = null;
        let maxFlipDiff = -1;

        matchups.forEach(m => {
            const squadPoints = m.players_points || {};
            const starters = (m.starters || []).map(pid => ({
                id: pid,
                points: squadPoints[pid] || 0,
                pos: players[pid]?.fantasy_positions?.[0]
            }));
            const bench = (m.players || [])
                .filter(pid => !m.starters.includes(pid))
                .map(pid => ({
                    id: pid,
                    points: squadPoints[pid] || 0,
                    pos: players[pid]?.fantasy_positions?.[0]
                }));

            starters.forEach(starter => {
                // Find bench player of SAME position (strict)
                const betterOption = bench
                    .filter(b => b.pos === starter.pos && b.points > starter.points)
                    .sort((a, b) => b.points - a.points)[0]; // Best option

                if (betterOption) {
                    const diff = betterOption.points - starter.points;
                    if (diff > maxFlipDiff) {
                        maxFlipDiff = diff;
                        const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === m.roster_id)?.owner_id);
                        coinFlipFail = {
                            manager: displayTeamName(user),
                            starter: players[starter.id],
                            starterPoints: starter.points.toFixed(1),
                            bench: players[betterOption.id],
                            benchPoints: betterOption.points.toFixed(1),
                            diff: diff.toFixed(1)
                        };
                    }
                }
            });
        });

        // 6. "The Cardio Kings" (Most starters < 5 pts)
        let cardioKing = null;
        let maxNapCount = -1;
        // Tie-breaker: lowest total score
        let lowestCardioScore = 9999;

        matchups.forEach(m => {
            const squadPoints = m.players_points || {};
            let count = 0;
            (m.starters || []).forEach(pid => {
                if ((squadPoints[pid] || 0) < 5) count++;
            });

            if (count > maxNapCount) {
                maxNapCount = count;
                lowestCardioScore = m.points;
                const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === m.roster_id)?.owner_id);
                cardioKing = {
                    manager: displayTeamName(user),
                    count: count,
                    score: m.points.toFixed(2)
                };
            } else if (count === maxNapCount && m.points < lowestCardioScore) {
                // Tie-breaker
                lowestCardioScore = m.points;
                const user = users.find(u => u.user_id === rosters.find(r => r.roster_id === m.roster_id)?.owner_id);
                cardioKing = {
                    manager: displayTeamName(user),
                    count: count,
                    score: m.points.toFixed(2)
                };
            }
        });

        return { robbery, matchupHighlight, topRookie, worstManager, bagCarrier, coinFlipFail, cardioKing };

    }, [league, matchups, rosters, users, players]);

    return analysis;
}

// Helper for Flex logic
function isValidPosition(playerPos, slotPos) {
    if (slotPos === playerPos) return true;
    if (slotPos === 'FLEX' && ['RB', 'WR', 'TE'].includes(playerPos)) return true;
    if (slotPos === 'SUPER_FLEX' && ['QB', 'RB', 'WR', 'TE'].includes(playerPos)) return true;
    if (slotPos === 'WRRB_FLEX' && ['RB', 'WR'].includes(playerPos)) return true;
    if (slotPos === 'REC_FLEX' && ['WR', 'TE'].includes(playerPos)) return true;
    return false;
}
