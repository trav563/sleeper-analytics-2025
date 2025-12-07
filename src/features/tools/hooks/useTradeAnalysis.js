import { useMemo } from 'react';

// Helper for Pick Valuation
const getPickValue = (round, rankInsideLeague, totalTeams) => {
    // 1.01 (Rank 1) -> Early
    // Round 1
    if (round === 1) {
        if (rankInsideLeague <= totalTeams * 0.33) return 1000; // Early 1st
        if (rankInsideLeague <= totalTeams * 0.66) return 700;  // Mid 1st
        return 500; // Late 1st
    }
    // Round 2
    if (round === 2) return 200;
    // Round 3
    if (round === 3) return 50;
    // Round 4+
    return 10;
};

export function useTradeAnalysis(league, rosters, players, seasonMatchups, currentWeek, tradedPicks) {
    // 1. Calculate Player Values (True PPG - Avg points excluding 0-point games)
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
                        // Fix: The Lamar Jackson Rule - Exclude 0.0 games (Injury/Bye)
                        if (points > 0) {
                            if (!valuesV2[playerId]) valuesV2[playerId] = { totalPoints: 0, games: 0 };
                            valuesV2[playerId].totalPoints += points;
                            valuesV2[playerId].games += 1;
                        }
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

    // 2. Analyze Team Needs & Surplus (with Picks)
    const teamAnalysis = useMemo(() => {
        if (!league || !rosters || !players || Object.keys(playerValues).length === 0) return {};

        const analysis = {}; // rosterId -> { needs: [], surplus: [], positionStrengths: {} }
        const leaguePositionScores = { QB: [], RB: [], WR: [], TE: [] };

        // Helper to get valid positions
        const validPositions = ['QB', 'RB', 'WR', 'TE'];

        // Dynasty Mode: Classify Teams
        const allPPTS = rosters.map(r => ({ rosterId: r.roster_id, ppts: r.settings?.ppts || 0 }))
            .sort((a, b) => a.ppts - b.ppts); // ASCENDING for Draft Order (Low Point = 1.01)

        // PPTS Rank Map (rosterId -> rank 1..N)
        const pptsRank = {};
        allPPTS.forEach((item, idx) => {
            pptsRank[item.rosterId] = idx + 1;
        });

        const totalTeams = rosters.length;
        // Status Thresholds (High PPTS = Good Team)
        // Sort DESC for status
        const sortedByStrength = [...allPPTS].sort((a, b) => b.ppts - a.ppts);
        const contenderThreshold = sortedByStrength[3]?.ppts || 0; // Top 4
        const rebuilderThreshold = sortedByStrength[Math.max(0, totalTeams - 4)]?.ppts || 0; // Bottom 4

        // --- PICK LEDGER START ---
        // Initialize ledger: Everyone owns their own picks for next 2 years (plus current if mid-season/not drafted?)
        // Assuming current season + 1 + 2 (3 years total usually tracked)
        // Sleeper `league.season` gives current year.
        const currentYear = parseInt(league.season);
        const draftYears = [currentYear + 1, currentYear + 2]; // Usually track future picks. Current year picks vanish after draft.
        // If league status is pre-draft, might need currentYear. Let's assume standard dynasty: future picks.

        const initialPicks = [];
        rosters.forEach(r => {
            draftYears.forEach(year => {
                [1, 2, 3].forEach(round => { // Assuming 3 rounds
                    initialPicks.push({
                        year,
                        round,
                        roster_id: r.roster_id, // Current Owner
                        original_owner_id: r.roster_id, // Origin
                        collection_id: r.roster_id // Origin ID for display if needed
                    });
                });
            });
        });

        // Apply Trades to update 'roster_id' (Current Owner)
        // tradedPicks: [{ season, round, roster_id (current owner), owner_id (new owner?? Wait check Sleeper API docs or assumption) }]
        // Sleeper API: `owner_id` is the PREVIOUS owner (sender), `roster_id` is ??? 
        // Docs say: `roster_id` is the roster the pick originated from. `owner_id` is the CURRENT owner roster ID.
        // YES. `roster_id` is ORIGIN. `owner_id` is CURRENT HOLDER.

        if (tradedPicks) {
            tradedPicks.forEach(tp => {
                const year = parseInt(tp.season);
                const pickIndex = initialPicks.findIndex(p =>
                    p.year === year &&
                    p.round === tp.round &&
                    p.original_owner_id === tp.roster_id // Match Origin
                );

                if (pickIndex !== -1) {
                    initialPicks[pickIndex].roster_id = tp.owner_id; // Update Current Owner
                }
            });
        }

        // Assign Values to Picks
        initialPicks.forEach(p => {
            const originRank = pptsRank[p.original_owner_id] || Math.floor(totalTeams / 2); // Default to mid if unknown
            p.value = getPickValue(p.round, originRank, totalTeams);

            // Description
            let desc = 'Mid';
            if (p.round === 1) {
                if (originRank <= totalTeams * 0.33) desc = 'Early';
                else if (originRank > totalTeams * 0.66) desc = 'Late';
            }
            p.description = `${p.year} ${p.round === 1 ? '1st' : p.round === 2 ? '2nd' : p.round + 'rd'} (${desc})`;
            p.isOriginal = p.roster_id === p.original_owner_id;
        });

        // Group picks by Current Owner
        const ledgerByRoster = {};
        initialPicks.forEach(p => {
            if (!ledgerByRoster[p.roster_id]) ledgerByRoster[p.roster_id] = [];
            ledgerByRoster[p.roster_id].push(p);
        });
        // --- PICK LEDGER END ---

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
                    return {
                        id: pid,
                        ...players[pid],
                        value: playerValues[pid] || 0,
                        isOTB: nickname?.toUpperCase().includes('OTB'),
                        age: players[pid]?.age || 25
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
            const usedPlayers = new Set();
            rosterPlayers.forEach(p => {
                if (validPositions.includes(p.position)) {
                    const limit = Math.ceil(slots[p.position] || 1);
                    if (starters[p.position].length < limit) {
                        starters[p.position].push(p);
                        usedPlayers.add(p.id);
                    }
                }
            });
            // Assign bench players (those not used as starters)
            rosterPlayers.forEach(p => {
                if (!usedPlayers.has(p.id)) {
                    bench.push(p);
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
                picks: ledgerByRoster[roster.roster_id] || [], // Attach Picks
                needs: [],
                surplus: []
            };
        });

        // Calculate Thresholds (Bottom 40% for Needs)
        const thresholds = {};
        validPositions.forEach(pos => {
            const scores = leaguePositionScores[pos].sort((a, b) => a - b);
            const cutoffIndex = Math.floor(scores.length * 0.4);
            thresholds[pos] = scores[cutoffIndex] || 0;
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
    }, [league, rosters, players, playerValues, tradedPicks]);

    // 3. Find Matches (Updated with Pick Logic)
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
            let pickSuggestions = []; // New Pick Trades

            // 1. Needs Matching (Player Swaps)
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
                    // DIRECTIONAL TRADING: Filter assets based on Receiver Status
                    let eligibleAssets = surplus.players;

                    // RULE 1: If Receiver is Rebuilder, PROHIBIT Age > 26
                    if (opponent.status === 'Rebuilder') {
                        eligibleAssets = eligibleAssets.filter(p => (p.age || 25) <= 26);
                    }

                    // Proceed if we still have valid assets to offer
                    if (eligibleAssets.length > 0) {
                        mutualSurplus.push({ position: needPos, assets: eligibleAssets });
                        score += 50; // Perfect match bonus

                        // RULE 2: Priority Bonus for Youth to Rebuilders
                        if (opponent.status === 'Rebuilder') {
                            const hasYouth = eligibleAssets.some(p => (p.age || 25) <= 24);
                            if (hasYouth) score += 20;
                        }
                    }
                }
            });

            // 2. Bench Upgrade Detector (with Dynasty Guardrails)
            opponent.bench.forEach(player => {
                const myStarters = focusTeam.starters[player.position];
                if (!myStarters || myStarters.length === 0) return;

                // Find worst starter
                const worstStarter = [...myStarters].sort((a, b) => a.value - b.value)[0];

                if (player.value > worstStarter.value) {
                    // Dynasty Guardrails
                    const targetAge = player.age || 25;
                    const currentAge = worstStarter.age || 25;
                    const isInjured = worstStarter.injury_status === 'IR' || worstStarter.injury_status === 'Out';

                    // IF (TargetPlayer.Age > CurrentPlayer.Age + 3 years)
                    // AND (CurrentPlayer.Age < 29)
                    // AND (CurrentPlayer.TruePPG > 15.0)
                    const isDynastyBadMove = (targetAge > currentAge + 3) && (currentAge < 29) && (worstStarter.value > 15.0);

                    let suggestionType = 'Upgrade';

                    if (isDynastyBadMove) {
                        if (focusTeam.status === 'Contender' && isInjured) {
                            // Exception: Win-Now Rental
                            suggestionType = 'Win-Now Rental';
                        } else {
                            // Suppress this suggestion
                            return;
                        }
                    }

                    benchUpgrades.push({
                        player,
                        upgradeOver: worstStarter,
                        diff: player.value - worstStarter.value,
                        type: suggestionType
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

            // 4. Dynasty Logic (with Picks)
            // Scenario A: Focus is REBUILDER. Wants Picks. Opponent is Contender/Neutral context.
            if (focusTeam.status === 'Rebuilder' && ['Contender', 'Neutral'].includes(opponent.status)) {
                // Determine assets to Sell: Vets (Age > 26) with value
                const sellableVets = focusTeam.rosterPlayers.filter(p => p.age > 26 && p.value > 10);

                if (sellableVets.length > 0 && opponent.picks.length > 0) {
                    // Find high value picks from opponent
                    const valuablePicks = opponent.picks.filter(p => p.round === 1 || p.round === 2);
                    if (valuablePicks.length > 0) {
                        pickSuggestions.push({
                            type: 'Rebuild: Sell High',
                            message: 'Sell vets for draft capital',
                            give: sellableVets.slice(0, 3), // Top 3
                            receive: valuablePicks
                        });
                        score += 40;
                    }
                }
            }

            // Scenario B: Focus is CONTENDER. Wants Vets. Can Sell Picks.
            if (focusTeam.status === 'Contender' && ['Rebuilder', 'Neutral'].includes(opponent.status)) {
                // My Picks to Sell
                const myPicks = focusTeam.picks.filter(p => p.round >= 1); // Any picks
                // Their Vets to Buy
                const targetVets = opponent.rosterPlayers.filter(p => p.age > 26 && p.value > 12);

                if (myPicks.length > 0 && targetVets.length > 0) {
                    pickSuggestions.push({
                        type: 'Contend: Buy Production',
                        message: 'Trade picks for veteran production',
                        give: myPicks,
                        receive: targetVets.slice(0, 3)
                    });
                    score += 40;
                }
            }

            // The prompt asks to ensure "You Get" section is populated.
            // We'll calculate a explicit 'targetAssets' list.

            let forcedTargets = [];
            // Strategy depends on OPPONENT Status (what can they give?)
            if (opponent.status === 'Rebuilder') {
                // They have Youth and High Picks
                // 1. Young Surplus
                const youngSurplus = opponent.surplus
                    .flatMap(s => s.players)
                    .filter(p => (p.age || 25) < 25)
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3);

                if (youngSurplus.length > 0) {
                    forcedTargets = youngSurplus.map(p => ({ ...p, type: 'Player' }));
                } else {
                    // 2. Draft Picks (Top 3)
                    forcedTargets = opponent.picks
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 3)
                        .map(p => ({ ...p, type: 'Pick', full_name: p.description, position: 'PICK' }));
                }
            } else {
                // Contender (or Neutral) -> They have Vets and Late Picks
                // 1. Veteran Surplus
                const vetSurplus = opponent.surplus
                    .flatMap(s => s.players)
                    .filter(p => (p.age || 25) >= 25)
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3);

                if (vetSurplus.length > 0) {
                    forcedTargets = vetSurplus.map(p => ({ ...p, type: 'Player' }));
                } else {
                    // 2. Late Draft Picks (or any picks)
                    forcedTargets = opponent.picks
                        .sort((a, b) => b.value - a.value) // Still best available
                        .slice(0, 3)
                        .map(p => ({ ...p, type: 'Pick', full_name: p.description, position: 'PICK' }));
                }
            }

            // Merge with mutualNeeds (Preferred Targets)
            // If mutualNeeds exists, we show those. If not, we show forcedTargets.
            // Actually prompt says: "Populate the 'Target Assets' ... If no [surplus], YOU MUST DISPLAY DRAFT PICKS"
            // So if `mutualNeeds` is empty, we USE forcedTargets.
            // We'll pass a refined `targetAssets` array to the UI.

            // Re-map mutualNeeds to flat assets for UI consumption if needed, or keep structure
            // existing structure: receiving: [{ position, assets: [] }]
            // We'll stick to that or better yet, make a unified `targets` list for the UI.

            // Let's create a NEW field `displayTargets` which consolidates this.
            let displayTargets = [];
            if (mutualNeeds.length > 0) {
                // Flatten
                mutualNeeds.forEach(g => displayTargets.push(...g.assets.map(a => ({ ...a, type: 'Player' }))));
            } else {
                displayTargets = forcedTargets;
                // If we are forcing targets, we should add a small score bump so these matches appear?
                // The prompt implies we want to fix the UI for *existing* matches or ensure matches exist?
                // "Ensure every Trade Card has two distinct sections... If ... empty, force it"
                // This implies we function on existing matches found via `score > 0`.
                // BUT if we rely only on other scores, we might miss these.
                // However, matching logic usually finds *something* (surplus match, bench upgrade, etc).
                // If score is 0, we might want to push a match purely based on "They have picks"? 
                // Let's assume we modify matches that qualify (score > 0). 
                // BUT if score is 0, maybe we should consider them valid if we found forcedTargets?
                // Providing options is good. Let's give a small score for having ANY targets.
                if (displayTargets.length > 0 && score === 0) {
                    score += 10;
                }
            }

            if (score > 0) {
                const isPerfect = mutualNeeds.length > 0 && mutualSurplus.length > 0;

                matches.push({
                    opponent,
                    type: isPerfect ? 'Perfect Match' : 'Potential Partner',
                    score: score + (isPerfect ? 50 : 0),
                    receiving: mutualNeeds, // Keep original structured data
                    displayTargets, // NEW: For UI Display
                    giving: mutualSurplus,
                    benchUpgrades,
                    dynastySuggestions,
                    pickSuggestions,
                    otbPlayers
                });
            }
        });

        return matches.sort((a, b) => b.score - a.score);
    };

    return { teamAnalysis, findMatches, playerValues };
}
