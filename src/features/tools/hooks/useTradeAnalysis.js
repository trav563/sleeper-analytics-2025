import { useMemo } from 'react';

// --- VALUATION HELPERS ---

// 1. Pick Value (KTC-style approx)
const getPickValue = (round, rankInsideLeague, totalTeams, isSuperflex = true) => {
    // Rank 1 = 1.01 (Highest Value)
    // Rank 12 = 1.12

    // Base Values
    if (round === 1) {
        // Early 1st (Top 3)
        if (rankInsideLeague <= 3) return 8000;
        // Mid 1st
        if (rankInsideLeague <= 8) return 5500;
        // Late 1st
        return 3800;
    }

    if (round === 2) {
        // Early 2nd
        if (rankInsideLeague <= 4) return 2200;
        // Mid/Late 2nd
        return 1400;
    }

    if (round === 3) return 400;
    return 100; // 4th+
};

// 2. Player Value Calculation
const calculatePlayerValue = (ppg, age, position, isSuperflex = true) => {
    if (!ppg || ppg <= 0) return 0;

    // Baseline Multiplier
    // e.g. 15pts * 300 = 4500
    let baseValue = ppg * 250;

    // Position Premiums
    if (position === 'QB') {
        if (isSuperflex) baseValue *= 1.8; // QB Gold in SF
        else baseValue *= 0.8; // Devalue in 1QB
    } else if (position === 'RB') {
        baseValue *= 1.0;
    } else if (position === 'WR') {
        baseValue *= 1.1; // Longevity
    } else if (position === 'TE') {
        baseValue *= 1.2; // Scarcity premium if producing
    }

    // Age Multipliers (Dynasty Curve)
    const safeAge = age || 25;

    if (safeAge <= 22) baseValue *= 1.35; // Young Star premium
    else if (safeAge <= 24) baseValue *= 1.15; // Prime Entry
    else if (safeAge >= 29) baseValue *= 0.6; // Age Cliff
    else if (safeAge >= 27 && position === 'RB') baseValue *= 0.7; // RB Cliff

    return Math.round(baseValue);
};


export function useTradeAnalysis(league, rosters, players, seasonMatchups, currentWeek, tradedPicks) {
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

        const finalStats = {};
        Object.keys(stats).forEach(pid => {
            finalStats[pid] = stats[pid].totalPoints / stats[pid].games;
        });

        return finalStats;
    }, [seasonMatchups, currentWeek]);

    // 2. Analyze Team Needs & Surplus (with Picks)
    const teamAnalysis = useMemo(() => {
        if (!league || !rosters || !players || Object.keys(playerStats).length === 0) return {};

        const analysis = {};
        const totalTeams = rosters.length;

        // Classify Status based on MaxPF (Potential Points)
        const allPPTS = rosters.map(r => ({ rosterId: r.roster_id, ppts: r.settings?.ppts || 0 }))
            .sort((a, b) => b.ppts - a.ppts); // High to Low

        const contenderThreshold = allPPTS[3]?.ppts || 0; // Top 4
        const rebuilderThreshold = allPPTS[Math.max(0, totalTeams - 4)]?.ppts || 0; // Bottom 4

        // --- PICK LEDGER ---
        const currentYear = parseInt(league.season);
        const nextYear = currentYear + 1; // Focus on upcoming class

        // Generate Base Picks
        let allPicks = [];
        rosters.forEach(r => {
            [currentYear + 1, currentYear + 2].forEach(year => {
                [1, 2, 3].forEach(round => {
                    allPicks.push({
                        id: `pick-${year}-${round}-${r.roster_id}`,
                        loading_id: `pick-${year}-${round}-${r.roster_id}`, // unique key
                        year,
                        round,
                        original_owner_id: r.roster_id,
                        roster_id: r.roster_id, // Current Owner
                        type: 'Pick'
                    });
                });
            });
        });

        // Apply Trades
        if (tradedPicks) {
            tradedPicks.forEach(tp => {
                const year = parseInt(tp.season);
                const pickIndex = allPicks.findIndex(p =>
                    p.year === year &&
                    p.round === tp.round &&
                    p.original_owner_id === tp.roster_id
                );
                if (pickIndex !== -1) {
                    allPicks[pickIndex].roster_id = tp.owner_id;
                }
            });
        }

        // Assign Values to Picks
        // We need draft order (reverse MaxPF)
        const draftOrder = [...allPPTS].sort((a, b) => a.ppts - b.ppts); // Low ppts first

        allPicks.forEach(p => {
            // Find original owner's rank in draft
            const draftIndex = draftOrder.findIndex(d => d.rosterId === p.original_owner_id);
            const rank = draftIndex !== -1 ? draftIndex + 1 : 6; // default mid

            p.tradeValue = getPickValue(p.round, rank, totalTeams, isSuperflex);

            // Text Desc
            let qual = 'Mid';
            if (rank <= 4) qual = 'Early';
            else if (rank >= 9) qual = 'Late';
            p.description = `${p.year} ${p.round === 1 ? '1st' : p.round === 2 ? '2nd' : p.round + 'rd'} (${qual})`;
            p.full_name = p.description; // Consistency with players
        });

        const ledgerByRoster = {};
        allPicks.forEach(p => {
            if (!ledgerByRoster[p.roster_id]) ledgerByRoster[p.roster_id] = [];
            ledgerByRoster[p.roster_id].push(p);
        });

        // --- BUILD ROSTER ANALYSIS ---
        rosters.forEach(roster => {
            const ppts = roster.settings?.ppts || 0;
            let status = 'Neutral';
            if (ppts >= contenderThreshold) status = 'Contender';
            else if (ppts <= rebuilderThreshold) status = 'Rebuilder';

            // Process Players
            const rosterPlayers = (roster.players || [])
                .map(pid => {
                    const p = players[pid];
                    if (!p) return null;
                    const ppg = playerStats[pid] || 0;
                    const tradeValue = calculatePlayerValue(ppg, p.age, p.position, isSuperflex);
                    const nickname = roster.metadata?.[`p_nick_${pid}`];

                    return {
                        id: pid,
                        ...players[pid],
                        value: playerStats[pid] || 0,
                        ppg: ppg.toFixed(1),
                        tradeValue,
                        isOTB: nickname?.toUpperCase().includes('OTB'),
                        type: 'Player',
                        isOTB: roster.metadata?.[`p_nick_${pid}`]?.toUpperCase().includes('OTB')
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.tradeValue - a.tradeValue);

            // Determine Needs (simplified logic using starter strength vs avg)
            // For concise trade logic, we'll focus on position counts vs requirements
            // and starter strength.

            const positions = ['QB', 'RB', 'WR', 'TE'];
            const myPicks = ledgerByRoster[roster.roster_id] || [];

            analysis[roster.roster_id] = {
                rosterId: roster.roster_id,
                ownerId: roster.owner_id,
                status,
                rosterPlayers,
                picks: myPicks,
                totalValue: rosterPlayers.reduce((sum, p) => sum + p.tradeValue, 0) + myPicks.reduce((sum, p) => sum + p.tradeValue, 0)
            };
        });

        return analysis;
    }, [league, rosters, players, playerStats, tradedPicks, isSuperflex]);

    // 3. Find Matches (STRICT RULES)
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

            // === SCENARIO 1: REBUILDER vs CONTENDER ===
            // Case A: Focus is REBUILDER. Target is CONTENDER.
            // Goal: Sell Vets -> Get Picks/Youth.
            if (focusTeam.status === 'Rebuilder' && opponentStatus === 'Contender') {

                // My Sellable Assets: Vets (>25) with Value
                const mySellList = focusTeam.rosterPlayers
                    .filter(p => (p.age > 24) && p.tradeValue > 2500) // Decent vets
                    .sort((a, b) => b.tradeValue - a.tradeValue);

                // Target Assets: Picks OR Young Players
                const theirPicks = opponent.picks.filter(p => p.round <= 2); // 1sts and 2nds
                const theirYouth = opponent.rosterPlayers.filter(p => p.age <= 23 && p.tradeValue > 2000);

                if (mySellList.length > 0 && (theirPicks.length > 0 || theirYouth.length > 0)) {
                    // Create Offer
                    const assetToSell = mySellList[0]; // Top asset
                    // Find fair match (+/- 15%)
                    const targetVal = assetToSell.tradeValue;

                    // Try to match with Pick + Filler
                    // Simplified: Just 1-for-1 or 1-for-Pick check
                    const bestPickDetails = theirPicks.find(p =>
                        Math.abs(p.tradeValue - targetVal) < (targetVal * 0.2) // looser 20% for picks
                    );

                    if (bestPickDetails) {
                        tradeProposals.push({
                            type: 'Rebuild: Cash Out',
                            message: `Sell ${assetToSell.last_name} for Draft Capital`,
                            give: [assetToSell],
                            receive: [bestPickDetails],
                            diff: bestPickDetails.tradeValue - targetVal
                        });
                        score += 80;
                    }
                    // Try Youth swap
                    else {
                        const bestYouth = theirYouth.find(p =>
                            Math.abs(p.tradeValue - targetVal) < (targetVal * 0.15)
                        );
                        if (bestYouth) {
                            tradeProposals.push({
                                type: 'Rebuild: Youth Swap',
                                message: `Pivot from ${assetToSell.last_name} to ${bestYouth.last_name}`,
                                give: [assetToSell],
                                receive: [bestYouth],
                                diff: bestYouth.tradeValue - targetVal
                            });
                            score += 70;
                        }
                    }
                }
            }

            // Case B: Focus is CONTENDER. Target is REBUILDER.
            // Goal: Buy Vets -> Give Picks/Youth.
            else if (focusTeam.status === 'Contender' && opponentStatus === 'Rebuilder') {

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
                            diff: targetVet.tradeValue - fairAsset.tradeValue
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

                // Let's iterate my top bench players
                const myTradables = focusTeam.rosterPlayers.slice(8, 15).filter(p => p.tradeValue > 1500); // Bench-ish

                myTradables.forEach(myP => {
                    const match = opponent.rosterPlayers.find(theirP => {
                        // Value Match
                        if (Math.abs(theirP.tradeValue - myP.tradeValue) > (myP.tradeValue * 0.1)) return false;
                        if (myP.position === theirP.position) return false; // meaningful swap needed usually

                        // Rules
                        if (focusTeam.status === 'Rebuilder' && theirP.age > 24) return false; // Deny Old
                        if (opponent.status === 'Rebuilder' && myP.age > 25) return false; // Don't insult them

                        return true;
                    });

                    if (match) {
                        tradeProposals.push({
                            type: 'Value Swap',
                            message: `Swap ${myP.position} depth for ${match.position} help`,
                            give: [myP],
                            receive: [match],
                            diff: match.tradeValue - myP.tradeValue
                        });
                        score += 30;
                    }
                });
            }

            // === FINAL MATCH CONSTRUCTION ===
            if (tradeProposals.length > 0) {
                // Pick best proposal
                const bestProposal = tradeProposals.sort((a, b) => b.type.includes('Win Now') ? 1 : -1)[0];

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
