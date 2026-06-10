/**
 * Draft Engine — Pure utility module for draft analysis
 * Handles roster needs, position weighting, best-available, and draft grading.
 * All functions are league-settings-aware: they read roster_positions and scoring_settings.
 */

// ─── Position Eligibility Map ─────────────────────────────────────────
// Which roster slots can each position fill?
const POSITION_FLEX_MAP = {
    QB:  ['QB', 'SUPER_FLEX', 'BN'],
    RB:  ['RB', 'FLEX', 'SUPER_FLEX', 'REC_FLEX', 'WRRB_FLEX', 'BN'],
    WR:  ['WR', 'FLEX', 'SUPER_FLEX', 'REC_FLEX', 'WRRB_FLEX', 'BN'],
    TE:  ['TE', 'FLEX', 'SUPER_FLEX', 'REC_FLEX', 'BN'],
    K:   ['K', 'BN'],
    DEF: ['DEF', 'BN'],
    DL:  ['DL', 'IDP_FLEX', 'BN'],
    LB:  ['LB', 'IDP_FLEX', 'BN'],
    DB:  ['DB', 'IDP_FLEX', 'BN'],
};

// Canonical starter positions (non-bench, non-IR)
const BENCH_SLOTS = ['BN', 'IR', 'TAXI'];

// Position display config
const POSITION_COLORS = {
    QB:  { bg: 'bg-rose-500/20',    text: 'text-rose-400',    border: 'border-rose-500/30',    dot: 'bg-rose-500' },
    RB:  { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
    WR:  { bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-500' },
    TE:  { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-500' },
    K:   { bg: 'bg-slate-500/20',   text: 'text-slate-400',   border: 'border-slate-500/30',   dot: 'bg-slate-400' },
    DEF: { bg: 'bg-purple-500/20',  text: 'text-purple-400',  border: 'border-purple-500/30',  dot: 'bg-purple-400' },
};

export const getPositionColor = (pos) => POSITION_COLORS[pos] || POSITION_COLORS.DEF;

// ─── 1. Analyze Roster Needs ──────────────────────────────────────────

/**
 * Analyze what roster slots are still needed based on league roster_positions.
 * 
 * @param {string[]} rosterPositions - league.roster_positions (e.g., ["QB","RB","RB","WR","WR","TE","FLEX","SUPER_FLEX","K","DEF","BN",...])
 * @param {Object[]} userDraftPicks - Picks made by this user in the current draft (from /draft/{id}/picks filtered by roster_id)
 * @param {Object} players - The full NFL players map (player_id -> player object)
 * @param {string[]} existingRosterPlayers - Player IDs on the user's existing roster (for dynasty rookie drafts)
 * @returns {{ needs: Object, filledSlots: Object, totalStarters: number, startersFilled: number, leagueFormat: string[] }}
 */
export function analyzeRosterNeeds(rosterPositions, userDraftPicks = [], players = {}, existingRosterPlayers = []) {
    if (!rosterPositions || !rosterPositions.length) {
        return { needs: {}, filledSlots: {}, totalStarters: 0, startersFilled: 0, leagueFormat: [] };
    }

    // Count required slots (starters only — exclude BN, IR, TAXI)
    const starterSlots = rosterPositions.filter(s => !BENCH_SLOTS.includes(s));
    const slotCounts = {};
    starterSlots.forEach(slot => {
        slotCounts[slot] = (slotCounts[slot] || 0) + 1;
    });

    // Build a list of positions the user has drafted + already owns
    const allPlayerIds = [
        ...userDraftPicks.map(p => p.player_id),
        ...existingRosterPlayers,
    ];

    const ownedPositions = allPlayerIds
        .map(pid => {
            const player = players[pid];
            if (!player) return null;
            // Use first fantasy position
            return player.fantasy_positions?.[0] || player.position || null;
        })
        .filter(Boolean);

    // Greedy slot-filling: fill the most restrictive slots first
    // Sort slots by flexibility (fewer eligible positions = more restrictive)
    const slotFlexibility = {};
    Object.keys(slotCounts).forEach(slot => {
        // Count how many positions can fill this slot
        const eligible = Object.entries(POSITION_FLEX_MAP).filter(([, slots]) => slots.includes(slot));
        slotFlexibility[slot] = eligible.length;
    });

    const sortedSlots = Object.keys(slotCounts).sort((a, b) => (slotFlexibility[a] || 99) - (slotFlexibility[b] || 99));

    // Track what's been filled
    const filledSlots = {};
    const remainingPlayers = [...ownedPositions];

    sortedSlots.forEach(slot => {
        filledSlots[slot] = { required: slotCounts[slot], filled: 0 };

        // Find players that can fill this slot
        for (let i = 0; i < filledSlots[slot].required; i++) {
            const playerIdx = remainingPlayers.findIndex(pos => {
                const eligibleSlots = POSITION_FLEX_MAP[pos] || [];
                return eligibleSlots.includes(slot);
            });
            if (playerIdx !== -1) {
                filledSlots[slot].filled++;
                remainingPlayers.splice(playerIdx, 1);
            }
        }
    });

    // Build the needs map
    const needs = {};
    Object.entries(filledSlots).forEach(([slot, { required, filled }]) => {
        const remaining = required - filled;
        if (remaining > 0) {
            needs[slot] = remaining;
        }
    });

    const totalStarters = starterSlots.length;
    const startersFilled = totalStarters - Object.values(needs).reduce((sum, n) => sum + n, 0);

    // Identify league format tags
    const leagueFormat = [];
    if (slotCounts.SUPER_FLEX) leagueFormat.push('Superflex');
    if ((slotCounts.TE || 0) >= 2) leagueFormat.push('2TE');
    if (slotCounts.REC_FLEX) leagueFormat.push('Rec Flex');
    if (slotCounts.IDP_FLEX || slotCounts.DL || slotCounts.LB || slotCounts.DB) leagueFormat.push('IDP');

    return { needs, filledSlots, totalStarters, startersFilled, leagueFormat };
}


// ─── 2. Position Value Multipliers ────────────────────────────────────

/**
 * Compute position value multipliers based on league scoring settings.
 * Higher multiplier = more valuable in this league format.
 * 
 * @param {Object} scoringSettings - league.scoring_settings
 * @param {string[]} rosterPositions - league.roster_positions
 * @returns {Object} - { QB: 1.5, RB: 1.0, WR: 1.15, TE: 1.4, K: 0.3, DEF: 0.3 }
 */
export function getPositionValueMultiplier(scoringSettings = {}, rosterPositions = []) {
    const multipliers = { QB: 1.0, RB: 1.0, WR: 1.0, TE: 1.0, K: 0.3, DEF: 0.3 };

    // Superflex: QB value skyrockets
    if (rosterPositions.includes('SUPER_FLEX')) {
        multipliers.QB *= 1.5;
    }

    // 6pt pass TD leagues boost QBs
    if ((scoringSettings.pass_td || 4) >= 6) {
        multipliers.QB *= 1.2;
    }

    // Full PPR boosts WR
    const ppr = scoringSettings.rec || 0;
    if (ppr >= 1) {
        multipliers.WR *= 1.15;
        multipliers.RB *= 0.95; // Slight RB discount in full PPR (pass-catching backs still good)
    } else if (ppr >= 0.5) {
        multipliers.WR *= 1.05;
    }

    // TE Premium
    const tePremium = scoringSettings.bonus_rec_te || 0;
    if (tePremium >= 1.0) {
        multipliers.TE *= 1.5;
    } else if (tePremium >= 0.5) {
        multipliers.TE *= 1.3;
    }

    // Multiple TE slots boost TE value
    const teSlots = rosterPositions.filter(s => s === 'TE').length;
    if (teSlots >= 2) {
        multipliers.TE *= 1.2;
    }

    return multipliers;
}


// ─── 3. Best Available Engine ─────────────────────────────────────────

/**
 * Get the best available players for drafting, adjusted by league settings and needs.
 * 
 * @param {Object} allPlayers - Full NFL player map (player_id -> player object)
 * @param {Set|string[]} draftedPlayerIds - IDs of players already drafted
 * @param {Object} marketValues - sleeper_id -> FantasyCalc value
 * @param {Object} positionMultipliers - from getPositionValueMultiplier()
 * @param {Object} needs - from analyzeRosterNeeds().needs
 * @param {number} limit - Number of results to return
 * @returns {Object[]} - Ranked list of available players with recommendation tags
 */
export function getBestAvailable(allPlayers, draftedPlayerIds, marketValues = {}, positionMultipliers = {}, needs = {}, limit = 15) {
    const drafted = draftedPlayerIds instanceof Set ? draftedPlayerIds : new Set(draftedPlayerIds);

    // Build candidates from market values (these are the relevant, valued players)
    const candidates = [];

    Object.entries(marketValues).forEach(([playerId, value]) => {
        if (drafted.has(playerId)) return;
        if (value < 100) return; // Filter out near-zero value players

        const player = allPlayers[playerId];
        if (!player) return;

        const pos = player.fantasy_positions?.[0] || player.position;
        if (!pos || !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(pos)) return;

        // Skip inactive/retired
        if (player.status === 'Inactive' && !player.team) return;

        const posMult = positionMultipliers[pos] || 1.0;
        
        // Needs boost: if this position fills a critical need, boost by 20%
        const posNeed = needs[pos] || 0;
        // Also check if this position fills FLEX/SUPER_FLEX needs
        const flexNeed = needs.FLEX || 0;
        const sfNeed = needs.SUPER_FLEX || 0;
        
        let needsBoost = 1.0;
        if (posNeed > 0) {
            needsBoost = 1.2 + (posNeed - 1) * 0.1; // More need = more boost
        } else if (pos !== 'K' && pos !== 'DEF' && flexNeed > 0) {
            needsBoost = 1.05;
        }

        const adjustedValue = value * posMult * needsBoost;

        // Determine recommendation tag
        let tag = 'BPA';  // Best Player Available (default)
        if (posNeed > 0) {
            tag = 'NEED';
        } else if (adjustedValue > value * 1.3) {
            tag = 'VALUE'; // Boosted significantly by league settings
        }

        candidates.push({
            player_id: playerId,
            name: `${player.first_name} ${player.last_name}`,
            position: pos,
            team: player.team || 'FA',
            age: player.age,
            value,
            adjustedValue,
            tag,
            positionMultiplier: posMult,
        });
    });

    // Sort by adjusted value descending
    candidates.sort((a, b) => b.adjustedValue - a.adjustedValue);

    return candidates.slice(0, limit);
}


// ─── 4. Draft Grade Calculator ────────────────────────────────────────

/**
 * Calculate draft grades based on pick-by-pick efficiency.
 * For each pick, we compare the selected player's value to the best player
 * that was still available at that pick position. This accounts for:
 * - Teams with fewer picks (1 great pick = high grade)
 * - Players already taken (you can't draft someone who's gone)
 * - Relative value: did you take the best option or reach?
 * 
 * @param {Object[]} picks - All picks from /draft/{id}/picks (in chronological order)
 * @param {Object} marketValues - sleeper_id -> FantasyCalc value
 * @param {number} totalTeams - Number of teams in the draft
 * @returns {Object} - roster_id -> { grade, efficiency, totalValue, avgValue, picks, bestPick, worstPick }
 */
export function calculateDraftGrades(picks, marketValues = {}, totalTeams = 12) {
    if (!picks?.length) return {};

    // Build the full pool of draftable players sorted by value (descending)
    // This represents everyone who COULD have been picked
    const allDraftableValues = Object.entries(marketValues)
        .map(([pid, val]) => ({ player_id: pid, value: val }))
        .filter(p => p.value > 0)
        .sort((a, b) => b.value - a.value);

    // Walk through picks in chronological order and track availability
    const draftedSet = new Set();
    const pickAnalysis = []; // { pick, value, bestAvailValue, efficiency, roster_id }

    picks.forEach((pick, idx) => {
        const pickValue = marketValues[String(pick.player_id)] || 0;

        // Find the best available player at this exact moment
        // (anyone with market value who hasn't been drafted yet)
        let bestAvailValue = 0;
        for (const candidate of allDraftableValues) {
            if (!draftedSet.has(candidate.player_id)) {
                bestAvailValue = candidate.value;
                break; // First undrafted = highest value available
            }
        }

        // Edge case: if we can't find a best available, use the pick value itself
        if (bestAvailValue === 0) bestAvailValue = pickValue || 1;

        // Efficiency: how close was this pick to the best available?
        // 1.0 = took the best player available, 0.5 = took someone worth half of BPA
        const efficiency = bestAvailValue > 0 ? pickValue / bestAvailValue : 0;

        pickAnalysis.push({
            pick_number: idx + 1,
            player_id: pick.player_id,
            roster_id: pick.roster_id,
            value: pickValue,
            bestAvailValue,
            efficiency: Math.min(efficiency, 1.0), // Cap at 1.0
        });

        // Mark this player as drafted
        draftedSet.add(String(pick.player_id));
    });

    // Group analysis by roster_id
    const teamAnalysis = {};
    pickAnalysis.forEach(pa => {
        const rid = pa.roster_id;
        if (!teamAnalysis[rid]) teamAnalysis[rid] = [];
        teamAnalysis[rid].push(pa);
    });

    // Calculate composite score per team
    // Composite = weighted blend of avg efficiency (70%) + total value rank percentile (30%)
    // This rewards smart picking (efficiency) while still giving credit for volume
    const teamScores = {};
    Object.entries(teamAnalysis).forEach(([rid, analysis]) => {
        const totalValue = analysis.reduce((sum, p) => sum + p.value, 0);
        const avgEfficiency = analysis.reduce((sum, p) => sum + p.efficiency, 0) / analysis.length;
        
        // Find best and worst picks by efficiency
        const sorted = [...analysis].sort((a, b) => b.efficiency - a.efficiency);
        const bestPick = sorted[0];
        const worstPick = sorted[sorted.length - 1];

        teamScores[rid] = {
            totalValue,
            avgValue: analysis.length ? Math.round(totalValue / analysis.length) : 0,
            picks: analysis.length,
            avgEfficiency: Math.round(avgEfficiency * 100), // 0-100 scale
            bestPick,
            worstPick,
            pickDetails: analysis,
        };
    });

    // Get total value ranking for the volume component
    const valueRanked = Object.entries(teamScores)
        .sort((a, b) => b[1].totalValue - a[1].totalValue);
    
    valueRanked.forEach(([rid], idx) => {
        teamScores[rid].valueRankPercentile = 1 - (idx / Math.max(1, valueRanked.length - 1));
    });

    // Compute composite score: 70% efficiency + 30% value rank
    Object.values(teamScores).forEach(data => {
        data.compositeScore = (data.avgEfficiency / 100) * 0.7 + (data.valueRankPercentile || 0) * 0.3;
    });

    // Rank by composite score and assign grades
    const ranked = Object.entries(teamScores)
        .sort((a, b) => b[1].compositeScore - a[1].compositeScore);

    const gradeScale = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];

    const grades = {};
    ranked.forEach(([rid, data], idx) => {
        const gradeIdx = Math.min(
            Math.floor(idx / Math.max(1, totalTeams / gradeScale.length)),
            gradeScale.length - 1
        );
        grades[rid] = {
            ...data,
            grade: gradeScale[gradeIdx],
            rank: idx + 1,
        };
    });

    return grades;
}


// ─── 5. Snake/Linear Draft Order Logic ────────────────────────────────

/**
 * Determine who is "on the clock" and compute pick metadata.
 * 
 * @param {string} draftType - "snake" or "linear"
 * @param {number} totalTeams - Number of teams
 * @param {number} totalRounds - Number of rounds
 * @param {number} picksMade - Number of picks completed
 * @param {Object} draftOrder - user_id -> draft_slot mapping
 * @param {Object} slotToRosterId - draft_slot -> roster_id mapping
 * @returns {{ round, pickInRound, draftSlot, rosterId, overallPick, totalPicks, isUserPick }}
 */
export function getOnTheClock(draftType, totalTeams, totalRounds, picksMade, draftOrder = {}, slotToRosterId = {}) {
    const totalPicks = totalTeams * totalRounds;
    
    if (picksMade >= totalPicks) {
        return { round: totalRounds, pickInRound: totalTeams, draftSlot: null, rosterId: null, overallPick: totalPicks, totalPicks, isDraftComplete: true };
    }

    const currentPick = picksMade + 1; // 1-indexed
    const round = Math.ceil(currentPick / totalTeams);
    const pickInRound = ((currentPick - 1) % totalTeams) + 1;

    // In snake drafts, even rounds go in reverse order
    let draftSlot;
    if (draftType === 'snake' && round % 2 === 0) {
        draftSlot = totalTeams - pickInRound + 1;
    } else {
        draftSlot = pickInRound;
    }

    const rosterId = slotToRosterId[String(draftSlot)] || null;

    return { round, pickInRound, draftSlot, rosterId, overallPick: currentPick, totalPicks, isDraftComplete: false };
}


// ─── 6. League Scoring Label Generator ────────────────────────────────

/**
 * Generate human-readable labels for a league's scoring/format settings.
 * 
 * @param {Object} scoringSettings - league.scoring_settings
 * @param {string[]} rosterPositions - league.roster_positions
 * @returns {string[]} - e.g., ["Superflex", "Full PPR", "TEP (+0.5)", "6pt Pass TD"]
 */
export function getLeagueFormatLabels(scoringSettings = {}, rosterPositions = []) {
    const labels = [];

    // Superflex
    if (rosterPositions.includes('SUPER_FLEX')) labels.push('Superflex');

    // PPR
    const ppr = scoringSettings.rec || 0;
    if (ppr >= 1) labels.push('Full PPR');
    else if (ppr >= 0.5) labels.push('Half PPR');
    else labels.push('Standard');

    // TE Premium
    const tep = scoringSettings.bonus_rec_te || 0;
    if (tep > 0) labels.push(`TEP (+${tep})`);

    // Pass TD
    const passTd = scoringSettings.pass_td || 4;
    if (passTd >= 6) labels.push('6pt Pass TD');

    // TE count
    const teCount = rosterPositions.filter(s => s === 'TE').length;
    if (teCount >= 2) labels.push(`${teCount}TE`);

    // Total starters
    const starters = rosterPositions.filter(s => !BENCH_SLOTS.includes(s)).length;
    labels.push(`${starters} starters`);

    return labels;
}
