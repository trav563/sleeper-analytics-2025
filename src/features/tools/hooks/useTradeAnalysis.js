import { useMemo } from 'react';
import { activeRosterIds } from '../../../utils/leagueMath';
import { buildPickLedger } from '../utils/pickLedger';
import { calculateFallbackValue } from '../utils/playerValue';

export function useTradeAnalysis(league, rosters, players, seasonMatchups, currentWeek, tradedPicks, marketValues = {}, isTradeWindowOpen = true) {
    // 0. Detect League Settings
    const isSuperflex = useMemo(() => {
        return league?.roster_positions?.includes('SUPER_FLEX');
    }, [league]);

    // 1. Calculate Player Stats (True PPG)
    const playerStats = useMemo(() => {
        if (!seasonMatchups || !currentWeek) return {};

        const stats = {};
        const startWeek = Math.max(1, currentWeek - 6); // Last 6 weeks for trend
        const endWeek = Math.max(1, currentWeek - 1);

        for (let w = startWeek; w <= endWeek; w++) {
            const weekMatchups = seasonMatchups[w];
            if (!weekMatchups) continue;

            if (weekMatchups) {
                weekMatchups.forEach(matchup => {
                    if (matchup.players_points) {
                        Object.entries(matchup.players_points).forEach(([playerId, points]) => {
                            // Exclude 0.0 games
                            if (points > 0) {
                                if (!stats[playerId]) stats[playerId] = { totalPoints: 0, games: 0 };
                                stats[playerId].totalPoints += points;
                                stats[playerId].games += 1;
                            }
                        });
                    }
                });
            }
        } // Close if (weekMatchups) AND for loop

        const finalStats = {};
        Object.keys(stats).forEach(pid => {
            finalStats[pid] = stats[pid].totalPoints / stats[pid].games;
        });

        return finalStats;
    }, [seasonMatchups, currentWeek]);

    // 2. Analyze Team Needs & Surplus (with Picks)
    const teamAnalysis = useMemo(() => {
        if (!league || !rosters || !players || !Array.isArray(rosters) || !league.roster_positions) return {};

        const analysis = {};
        const totalTeams = rosters.length;

        // Classify Status based on MaxPF (Potential Points)
        const allPPTS = rosters.map(r => ({ rosterId: r.roster_id, ppts: r.settings?.ppts || 0 }))
            .sort((a, b) => b.ppts - a.ppts); // High to Low

        const contenderThreshold = allPPTS[3]?.ppts || 0; // Top 4
        const rebuilderThreshold = allPPTS[Math.max(0, totalTeams - 4)]?.ppts || 0; // Bottom 4

        // --- PICK LEDGER --- (shared with DynastyWindow; see utils/pickLedger)
        const { ledgerByRoster } = buildPickLedger(league, rosters, tradedPicks, marketValues, isSuperflex);

        // --- BUILD ROSTER ANALYSIS ---
        rosters.forEach(roster => {
            const ppts = roster.settings?.ppts || 0;
            let status = 'Neutral';
            if (ppts >= contenderThreshold) status = 'Contender';
            else if (ppts <= rebuilderThreshold) status = 'Rebuilder';

            // Process Players (active roster only — taxi/IR aren't tradeable
            // assets in the proposal engine's sense and skew age/value reads)
            const rosterPlayers = activeRosterIds(roster)
                .map(pid => {
                    const p = players[pid];
                    if (!p || p.position === 'DEF') return null;
                    const ppg = playerStats[pid] || 0;

                    // MARKET VALUE INTEGRATION
                    // Priority: Real Market Data > Fallback Formula
                    let tradeValue = marketValues[pid];
                    if (!tradeValue) {
                        tradeValue = calculateFallbackValue(ppg, p.age, p.position, isSuperflex, p.search_rank);
                    }

                    const nickname = roster.metadata?.[`p_nick_${pid}`];

                    return {
                        id: pid,
                        ...players[pid],
                        value: playerStats[pid] || 0,
                        ppg: ppg.toFixed(1),
                        tradeValue,
                        isOTB: nickname?.toUpperCase().includes('OTB'),
                        type: 'Player',
                        isDynastyStash: tradeValue > 2500 && ppg < 8 // High Value, Low Production
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.tradeValue - a.tradeValue);

            // Determine Needs & Surplus (Heuristic based on Trade Values)
            const myPicks = ledgerByRoster[roster.roster_id] || [];
            const needs = [];
            const surplus = []; // Store full objects { position, count } or just strings

            const counts = {
                QB: rosterPlayers.filter(p => p.position === 'QB' && p.tradeValue > 3500).length,
                RB: rosterPlayers.filter(p => p.position === 'RB' && p.tradeValue > 1800).length,
                WR: rosterPlayers.filter(p => p.position === 'WR' && p.tradeValue > 1800).length,
                TE: rosterPlayers.filter(p => p.position === 'TE' && p.tradeValue > 1500).length
            };

            // Needs Thresholds
            if (isSuperflex && counts.QB < 2) needs.push('QB');
            if (!isSuperflex && counts.QB < 1) needs.push('QB');
            if (counts.RB < 2) needs.push('RB');
            if (counts.WR < 3) needs.push('WR');
            if (counts.TE < 1) needs.push('TE');

            // Surplus Thresholds
            if (isSuperflex && counts.QB > 2) surplus.push({ position: 'QB', count: counts.QB });
            if (!isSuperflex && counts.QB > 1) surplus.push({ position: 'QB', count: counts.QB });
            if (counts.RB > 3) surplus.push({ position: 'RB', count: counts.RB });
            if (counts.WR > 4) surplus.push({ position: 'WR', count: counts.WR });
            if (counts.TE > 1) surplus.push({ position: 'TE', count: counts.TE });

            analysis[roster.roster_id] = {
                rosterId: roster.roster_id,
                ownerId: roster.owner_id,
                status,
                rosterPlayers,
                picks: myPicks,
                needs,
                surplus,
                totalValue: rosterPlayers.reduce((sum, p) => sum + p.tradeValue, 0) + myPicks.reduce((sum, p) => sum + p.tradeValue, 0)
            };
        });

        return analysis;
    }, [league, rosters, players, playerStats, tradedPicks, isSuperflex, marketValues]); // Added marketValues dep

    // 3. Find Matches (STRICT RULES + DEADLINE AWARENESS)
    const findMatches = (focusRosterId) => {
        const focusTeam = teamAnalysis[focusRosterId];
        if (!focusTeam) return [];

        const matches = [];

        Object.values(teamAnalysis).forEach(opponent => {
            if (opponent.rosterId === focusRosterId) return;

            // -- Logic --
            const opponentStatus = opponent.status;
            let score = 0;
            const tradeProposals = []; // { type, give: [], receive: [] }

            // === SCENARIO 1: REBUILDER vs BUYERS (Contender/Neutral) ===
            // Case A: Focus is REBUILDER. Target is Buying (Contender or Neutral).
            // Goal: Liquidation Mode. Sell Vets -> Get Picks.
            const isBuyer = opponentStatus === 'Contender' || opponentStatus === 'Neutral';

            if (focusTeam.status === 'Rebuilder' && isBuyer) {

                // My Sellable Assets: Vets (>24) with Value
                const mySellList = focusTeam.rosterPlayers
                    .filter(p => (p.age > 24) && p.tradeValue > 2500)
                    .sort((a, b) => b.tradeValue - a.tradeValue);

                // Target Assets: Future Picks (Primary) or Elite Youth (Secondary)
                const theirPicks = opponent.picks.filter(p => p.round <= 2); // 1sts and 2nds

                if (mySellList.length > 0 && theirPicks.length > 0) {
                    // Iterate my sellable assets to find a pick match
                    for (const assetToSell of mySellList) {
                        const targetVal = assetToSell.tradeValue;

                        // Find Pick Match (+/- 25% tolerance for picks to encourage deals)
                        const matchingPick = theirPicks.find(p =>
                            Math.abs(p.tradeValue - targetVal) < (targetVal * 0.25)
                        );

                        if (matchingPick) {
                            tradeProposals.push({
                                type: '💰 Rebuild: Cash Out',
                                message: `Liquidation Mode: Send ${assetToSell.last_name} for ${matchingPick.description}`,
                                give: [assetToSell],
                                receive: [matchingPick],
                                diff: matchingPick.tradeValue - targetVal,
                                priority: 100 // High priority
                            });
                            score += 95; // Boost match score
                            break; // Found top deal
                        }
                    }
                }

                // Secondary: Youth Swap if no picks found
                if (tradeProposals.length === 0 && mySellList.length > 0) {
                    const theirYouth = opponent.rosterPlayers.filter(p => p.age <= 23 && p.tradeValue > 2000);
                    const assetToSell = mySellList[0];
                    const bestYouth = theirYouth.find(p => Math.abs(p.tradeValue - assetToSell.tradeValue) < (assetToSell.tradeValue * 0.2));

                    if (bestYouth) {
                        tradeProposals.push({
                            type: 'Rebuild: Youth Swap',
                            message: `Pivot from ${assetToSell.last_name} to ${bestYouth.last_name}`,
                            give: [assetToSell],
                            receive: [bestYouth],
                            diff: bestYouth.tradeValue - assetToSell.tradeValue,
                            priority: 80
                        });
                        score += 70;
                    }
                }
            }

            // Case B: Focus is CONTENDER. Target is REBUILDER.
            // Goal: Buy Vets -> Give Picks/Youth.
            // RULES: Only active if TRADE WINDOW IS OPEN
            else if (isTradeWindowOpen && focusTeam.status === 'Contender' && opponentStatus === 'Rebuilder') {

                // My Sellable: Picks & Youth
                // STRICT RULE CHECK: Rebuilder CANNOT buy old players.
                const mySellList = [
                    ...focusTeam.picks.filter(p => p.round <= 2),
                    ...focusTeam.rosterPlayers.filter(p => p.age <= 23 && p.tradeValue > 2000)
                ];

                // Target Assets: Their Vets
                const theirVets = opponent.rosterPlayers.filter(p => p.age >= 25 && p.tradeValue > 3000);

                if (theirVets.length > 0 && mySellList.length > 0) {
                    const targetVet = theirVets[0]; // Best vet

                    // Match with my pick
                    const fairAsset = mySellList.find(a =>
                        Math.abs(a.tradeValue - targetVet.tradeValue) < (targetVet.tradeValue * 0.2)
                    );

                    if (fairAsset) {
                        tradeProposals.push({
                            type: 'Win Now: Buy Star',
                            message: `Acquire ${targetVet.last_name} for ${fairAsset.full_name}`,
                            give: [fairAsset],
                            receive: [targetVet],
                            diff: targetVet.tradeValue - fairAsset.tradeValue,
                            priority: 90
                        });
                        score += 90;
                    }
                }
            }

            // === SCENARIO 2: GENERAL VALUE TRADING (Any Status) ===
            // Identify Bench upgrades / Positional Swaps

            // Logic: Find my bench player > Their starter
            // Constraint: Rebuilders must get YOUNGER in the swap. Contenders can get older.

            // Simplified Fair Trade Finder for Proposals
            if (tradeProposals.length === 0) {
                // Fallback: Find 1-for-1 trade with exact value match (+/- 10%)
                // Only if it makes sense relationally (Positional swap? Age swap?)
                // OFFSEASON LOGIC: If offseasn, ignore starters/bench distinction, simply look for value.

                // Let's iterate my top bench players
                const myTradables = focusTeam.rosterPlayers.slice(8, 15).filter(p => p.tradeValue > 1500); // Bench-ish

                myTradables.forEach(myP => {
                    const match = opponent.rosterPlayers.find(theirP => {
                        // Value Match
                        if (Math.abs(theirP.tradeValue - myP.tradeValue) > (myP.tradeValue * 0.1)) return false;
                        if (myP.position === theirP.position) return false; // meaningful swap needed usually

                        // Hard block: never trade away a need position to receive a surplus position
                        const tradingFromNeed = focusTeam.needs.includes(myP.position);
                        const receivingSurplus = focusTeam.surplus.some(s => s.position === theirP.position);
                        if (tradingFromNeed && receivingSurplus) return false;

                        // Rules
                        if (focusTeam.status === 'Rebuilder' && theirP.age > 24) return false; // Deny Old
                        if (opponent.status === 'Rebuilder' && myP.age > 25) return false; // Don't insult them

                        return true;
                    });

                    if (match) {
                        // Score based on how much the trade improves positional balance
                        let priority = 30;
                        if (focusTeam.needs.includes(match.position)) priority += 30; // filling a need
                        if (focusTeam.surplus.some(s => s.position === myP.position)) priority += 15; // trading from surplus
                        if (focusTeam.surplus.some(s => s.position === match.position)) priority -= 20; // receiving surplus

                        tradeProposals.push({
                            type: focusTeam.needs.includes(match.position) ? 'Perfect Match' : 'Value Swap',
                            message: `Swap ${myP.position} depth for ${match.position} help`,
                            give: [myP],
                            receive: [match],
                            diff: match.tradeValue - myP.tradeValue,
                            priority
                        });
                        score += priority;
                    }
                });
            }

            // === FINAL MATCH CONSTRUCTION ===
            if (tradeProposals.length > 0) {
                // Pick best proposal based on priority
                const bestProposal = tradeProposals.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];

                matches.push({
                    opponent,
                    score: score || 50, // Default score if proposals found
                    type: bestProposal.type,
                    proposals: tradeProposals,
                    // Legacy UI Support fields
                    giving: [{ assets: bestProposal.give }],
                    receiving: [{ assets: bestProposal.receive }],
                    displayTargets: bestProposal.receive,
                    benchUpgrades: [], // Deprecated or re-calc if needed
                    dynastySuggestions: [{ message: bestProposal.message, assets: bestProposal.receive }]
                });
            }
        });

        return matches.sort((a, b) => b.score - a.score);
    };

    return { teamAnalysis, findMatches, playerValues: playerStats };
}
