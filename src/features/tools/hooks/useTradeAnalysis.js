import { useMemo } from 'react';

export function useTradeAnalysis(league, rosters, players, seasonMatchups, currentWeek) {
    // 1. Calculate Player Values (Avg points over last 5 weeks)
    const playerValues = useMemo(() => {
        if (!seasonMatchups || !currentWeek) return {};

        const valuesV2 = {};
        const startWeek = Math.max(1, currentWeek - 5);
        const endWeek = Math.max(1, currentWeek - 1);

        for (let w = startWeek; w <= endWeek; w++) {
            const weekMatchups = seasonMatchups[w];
            if (!weekMatchups) continue;

            weekMatchups.forEach(matchup => {
                if (matchup.players_points) {
                    Object.entries(matchup.players_points).forEach(([playerId, points]) => {
                        if (!valuesV2[playerId]) valuesV2[playerId] = { totalPoints: 0, games: 0 };
                        valuesV2[playerId].totalPoints += points;
                        valuesV2[playerId].games += 1;
                    });
                }
            });
        }

        const finalValues = {};
        Object.keys(valuesV2).forEach(pid => {
            finalValues[pid] = valuesV2[pid].totalPoints / valuesV2[pid].games;
        });

        return finalValues;
    }, [seasonMatchups, currentWeek]);

    // 2. Analyze Team Needs & Surplus
    const teamAnalysis = useMemo(() => {
        if (!league || !rosters || !players || Object.keys(playerValues).length === 0) return {};

        const analysis = {}; // rosterId -> { needs: [], surplus: [], positionStrengths: {} }
        const leaguePositionScores = { QB: [], RB: [], WR: [], TE: [] };

        // Helper to get valid positions
        const validPositions = ['QB', 'RB', 'WR', 'TE'];

        // Dynasty Mode: Classify Teams
        const allPPTS = rosters.map(r => r.settings?.ppts || 0).sort((a, b) => b - a);
        const contenderThreshold = allPPTS[3] || 0; // Top 4
        const rebuilderThreshold = allPPTS[Math.max(0, allPPTS.length - 4)] || 0; // Bottom 4

        rosters.forEach(roster => {
            // Dynasty Status
            const ppts = roster.settings?.ppts || 0;
            let status = 'Neutral';
            if (ppts >= contenderThreshold) status = 'Contender';
            else if (ppts <= rebuilderThreshold) status = 'Rebuilder';

            // Get all players with their values
            const rosterPlayers = (roster.players || [])
                .map(pid => {
                    const nickname = roster.metadata?.[`p_nick_${pid}`];
                    const isOTB = nickname && nickname.toUpperCase().includes('OTB');
                    return {
                        id: pid,
                        ...players[pid],
                        value: playerValues[pid] || 0,
                        isOTB
                    };
                })
                .sort((a, b) => b.value - a.value);

            // Determine "Starters" based on league settings (simplified)
            const starters = { QB: [], RB: [], WR: [], TE: [] };
            const bench = [];

            const slots = {
                ...league.roster_positions.reduce((acc, pos) => {
                    if (validPositions.includes(pos)) acc[pos] = (acc[pos] || 0) + 1;
                    if (pos === 'FLEX') {
                        acc['RB'] = (acc['RB'] || 0) + 0.5;
                        acc['WR'] = (acc['WR'] || 0) + 0.5;
                    }
                    return acc;
                }, {})
            };

            // Assign starters
            rosterPlayers.forEach(p => {
                if (validPositions.includes(p.position)) {
                    const limit = Math.ceil(slots[p.position] || 1);
                    if (starters[p.position].length < limit) {
                        starters[p.position].push(p);
                    } else {
                        bench.push(p);
                    }
                }
            });

            // Calculate Strength (Avg points of starters)
            const strengths = {};
            validPositions.forEach(pos => {
                const positionStarters = starters[pos];
                const total = positionStarters.reduce((sum, p) => sum + p.value, 0);
                strengths[pos] = positionStarters.length > 0 ? total / positionStarters.length : 0;
                leaguePositionScores[pos].push(strengths[pos]);
            });

            analysis[roster.roster_id] = {
                rosterId: roster.roster_id,
                ownerId: roster.owner_id,
                status, // Contender / Rebuilder / Neutral
                strengths,
                starters,
                bench,
                rosterPlayers, // All players for easy access
                needs: [],
                surplus: []
            };
        });

        // Calculate Thresholds (Bottom 40% for Needs)
        const thresholds = {};
        validPositions.forEach(pos => {
            const scores = leaguePositionScores[pos].sort((a, b) => a - b);
            const cutoffIndex = Math.floor(scores.length * 0.4);
            thresholds[pos] = scores[cutoffIndex];
        });

        // Calculate Starter Baselines (The score needed to be a starter in this league)
        const starterBaselines = {};
        validPositions.forEach(pos => {
            // Collect all starter scores for this position
            const allStarterScores = [];
            Object.values(analysis).forEach(team => {
                team.starters[pos].forEach(p => allStarterScores.push(p.value));
            });
            // Sort descending
            allStarterScores.sort((a, b) => b - a);

            // The baseline is the score of the lowest ranked starter
            // If we have 12 teams and 2 WRs, we look at the top 24 scores.
            // But since we already filtered "starters" in the previous step based on slots,
            // `allStarterScores` should contain exactly the number of starters in the league.
            // So the last player in this list is the "worst starter".
            // Let's use the value at the 80th percentile (bottom 20%) to be safe?
            // Or just the median?
            // Let's stick to the prompt: "would be starters on an average team".
            // An average team has average starters.
            // Let's use the Median of the starter scores.
            const medianIndex = Math.floor(allStarterScores.length / 2);
            starterBaselines[pos] = allStarterScores[medianIndex] || 0;
        });

        // Identify Needs and Surplus
        Object.values(analysis).forEach(team => {
            // Needs
            validPositions.forEach(pos => {
                if (team.strengths[pos] <= thresholds[pos]) {
                    team.needs.push(pos);
                }
            });

            // Surplus: Bench players performing like average starters
            validPositions.forEach(pos => {
                // Use the calculated baseline (Median starter score)
                const baseline = starterBaselines[pos];
                const surplusPlayers = team.bench.filter(p => p.position === pos && p.value >= baseline);

                if (surplusPlayers.length > 0) {
                    team.surplus.push({
                        position: pos,
                        players: surplusPlayers
                    });
                }
            });
        });

        return analysis;
    }, [league, rosters, players, playerValues]);

    // 3. Find Matches
    const findMatches = (focusRosterId) => {
        if (!focusRosterId || !teamAnalysis[focusRosterId]) return [];

        const focusTeam = teamAnalysis[focusRosterId];
        const matches = [];

        Object.values(teamAnalysis).forEach(opponent => {
            if (opponent.rosterId === focusRosterId) return;

            let score = 0;
            const mutualNeeds = [];
            const mutualSurplus = [];
            const benchUpgrades = [];
            const dynastySuggestions = [];

            // 1. Needs Matching
            focusTeam.needs.forEach(needPos => {
                const surplus = opponent.surplus.find(s => s.position === needPos);
                if (surplus) {
                    mutualNeeds.push({ position: needPos, assets: surplus.players });
                    score += 50;
                }
            });

            opponent.needs.forEach(needPos => {
                const surplus = focusTeam.surplus.find(s => s.position === needPos);
                if (surplus) {
                    mutualSurplus.push({ position: needPos, assets: surplus.players });
                    score += 50; // Perfect match bonus
                }
            });

            // 2. Bench Upgrade Detector
            opponent.bench.forEach(player => {
                const myStarters = focusTeam.starters[player.position];
                if (!myStarters || myStarters.length === 0) return;

                // Find worst starter
                const worstStarter = [...myStarters].sort((a, b) => a.value - b.value)[0];

                if (player.value > worstStarter.value) {
                    benchUpgrades.push({
                        player,
                        upgradeOver: worstStarter,
                        diff: player.value - worstStarter.value
                    });
                    score += 20; // Upgrade bonus
                }
            });

            // 3. OTB Scanner Bonus
            const otbPlayers = opponent.rosterPlayers.filter(p => p.isOTB);
            otbPlayers.forEach(p => {
                // If OTB player matches a need, big bonus
                if (focusTeam.needs.includes(p.position)) {
                    score += 30;
                }
            });

            // 4. Dynasty Logic
            if (focusTeam.status === 'Contender' && opponent.status === 'Rebuilder') {
                // Look for Vets on Opponent
                const vets = opponent.rosterPlayers.filter(p => p.age >= 27 && (p.position === 'RB' || p.position === 'WR') || p.age >= 30);
                if (vets.length > 0) {
                    dynastySuggestions.push({
                        type: 'Win-Now Move',
                        message: `History suggests ${opponent.status} teams want to move veterans.`,
                        assets: vets
                    });
                    score += 10;
                }
            } else if (focusTeam.status === 'Rebuilder' && opponent.status === 'Contender') {
                // Look for Youth on Opponent
                const youth = opponent.rosterPlayers.filter(p => p.age < 25);
                if (youth.length > 0) {
                    dynastySuggestions.push({
                        type: 'Rebuild Move',
                        message: `Contenders often trade youth for immediate production.`,
                        assets: youth
                    });
                    score += 10;
                }
            }

            if (score > 0) {
                // Correct Perfect Match Logic: Must have BOTH mutual needs and mutual surplus
                const isPerfect = mutualNeeds.length > 0 && mutualSurplus.length > 0;

                matches.push({
                    opponent,
                    type: isPerfect ? 'Perfect Match' : 'Potential Partner',
                    score: score + (isPerfect ? 50 : 0), // Bonus for perfect match
                    receiving: mutualNeeds,
                    giving: mutualSurplus,
                    benchUpgrades,
                    dynastySuggestions,
                    otbPlayers
                });
            }
        });

        return matches.sort((a, b) => b.score - a.score);
    };

    return { teamAnalysis, findMatches, playerValues };
}
