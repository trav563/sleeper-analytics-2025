import { useMemo } from 'react';

export function useTradeAnalysis(league, rosters, players, seasonMatchups, currentWeek) {
    // 1. Calculate Player Values (Avg points over last 5 weeks)
    const playerValues = useMemo(() => {
        if (!seasonMatchups || !currentWeek) return {};

        const values = {}; // playerId -> { totalPoints, games, avg }
        const startWeek = Math.max(1, currentWeek - 5);
        const endWeek = Math.max(1, currentWeek - 1);

        // Iterate through relevant weeks
        for (let w = startWeek; w <= endWeek; w++) {
            const weekMatchups = seasonMatchups[w];
            if (!weekMatchups) continue;

            weekMatchups.forEach(matchup => {
                matchup.starters.forEach((playerId, idx) => {
                    if (playerId === "0") return;
                    const points = matchup.starters_points[idx];
                    if (!values[playerId]) values[playerId] = { totalPoints: 0, games: 0 };
                    values[playerId].totalPoints += points;
                    values[playerId].games += 1;
                });
                // Also check bench if available? Sleeper matchups usually only have starters points.
                // If we want bench points, we might need players' stats API, but user said "use matchups".
                // Sleeper matchups endpoint includes 'players_points' dictionary for ALL players on roster!
                if (matchup.players_points) {
                    Object.entries(matchup.players_points).forEach(([playerId, points]) => {
                        // If we already processed this player as a starter, don't double count?
                        // Actually, 'players_points' covers everyone. Let's use that instead of starters loop.
                    });
                }
            });
        }

        // Re-do using players_points for accuracy
        const valuesV2 = {};
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
        const rosterPositions = league.roster_positions.filter(p => validPositions.includes(p));

        rosters.forEach(roster => {
            // Get all players with their values
            const rosterPlayers = (roster.players || [])
                .map(pid => ({
                    id: pid,
                    ...players[pid],
                    value: playerValues[pid] || 0
                }))
                .sort((a, b) => b.value - a.value);

            // Determine "Starters" based on league settings (simplified)
            // We'll just take top N players for each position based on roster slots
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
                    // Simple logic: if we have "slots" left, they are a starter
                    // Note: This is an approximation. FLEX handling is tricky.
                    // Let's just take the top X players per position where X is roughly the number of starters.
                    // E.g. 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX -> Top 1 QB, Top 3 RB, Top 3 WR, Top 1 TE (generous)
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
                strengths,
                starters,
                bench,
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

        // Identify Needs and Surplus
        Object.values(analysis).forEach(team => {
            // Needs
            validPositions.forEach(pos => {
                if (team.strengths[pos] <= thresholds[pos]) {
                    team.needs.push(pos);
                }
            });

            // Surplus: Bench players performing like average starters
            // Avg starter value for this position across league
            validPositions.forEach(pos => {
                const avgStarterVal = leaguePositionScores[pos].reduce((a, b) => a + b, 0) / leaguePositionScores[pos].length;
                const surplusPlayers = team.bench.filter(p => p.position === pos && p.value >= avgStarterVal);

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

            const mutualNeeds = []; // Opponent has surplus in Focus Need
            const mutualSurplus = []; // Opponent needs Focus Surplus

            // Check if Opponent has what Focus needs
            focusTeam.needs.forEach(needPos => {
                const surplus = opponent.surplus.find(s => s.position === needPos);
                if (surplus) {
                    mutualNeeds.push({
                        position: needPos,
                        assets: surplus.players
                    });
                }
            });

            // Check if Focus has what Opponent needs
            opponent.needs.forEach(needPos => {
                const surplus = focusTeam.surplus.find(s => s.position === needPos);
                if (surplus) {
                    mutualSurplus.push({
                        position: needPos,
                        assets: surplus.players
                    });
                }
            });

            if (mutualNeeds.length > 0) {
                const isPerfect = mutualSurplus.length > 0;
                matches.push({
                    opponent,
                    type: isPerfect ? 'Perfect Match' : 'One-Way Match',
                    score: isPerfect ? 100 : 50,
                    receiving: mutualNeeds, // What Focus gets
                    giving: mutualSurplus // What Focus gives
                });
            }
        });

        return matches.sort((a, b) => b.score - a.score);
    };

    return { teamAnalysis, findMatches, playerValues };
}
