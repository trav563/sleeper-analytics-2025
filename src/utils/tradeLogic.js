/**
 * Trade Logic Engine
 * Evaluates rosters and players to provide agentic strategic advice.
 */

/**
 * Determines a team's current dynasty lifecycle phase based on their rank.
 * @param {Object} roster 
 * @param {Array} allRosters 
 * @returns {string} 'CONTENDER' | 'REBUILDING' | 'FRINGE'
 */
export const getTeamLifecycle = (roster, allRosters) => {
    if (!roster || !allRosters || allRosters.length === 0) return 'FRINGE';

    // Sort rosters by MaxPF (or PF if MaxPF is unavailable)
    const sorted = [...allRosters].sort((a, b) => {
        const pfA = (a.settings?.ppts || 0) + (a.settings?.ppts_decimal || 0) / 100;
        const pfB = (b.settings?.ppts || 0) + (b.settings?.ppts_decimal || 0) / 100;
        return pfB - pfA;
    });

    const index = sorted.findIndex(r => r.roster_id === roster.roster_id);
    if (index === -1) return 'FRINGE';

    const totalTeams = allRosters.length;
    
    // Top 1/3 are Contenders, Bottom 1/3 are Rebuilding
    if (index < Math.ceil(totalTeams / 3)) return 'CONTENDER';
    if (index >= Math.floor((totalTeams / 3) * 2)) return 'REBUILDING';
    
    return 'FRINGE';
};

/**
 * Evaluates a player's fit on their current roster and outputs a strategic verdict.
 * @param {Object} player Player object from Sleeper (needs age, position)
 * @param {number} marketValue FantasyCalc value
 * @param {string} teamLifecycle 'CONTENDER' | 'REBUILDING' | 'FRINGE'
 * @returns {Object} { status: string, reason: string, color: string }
 */
export const getPlayerVerdict = (player, marketValue, teamLifecycle) => {
    if (!player || !player.position) return null;

    const age = player.age || 25; // Default if missing
    const pos = player.position;

    // --- REBUILDING LOGIC ---
    if (teamLifecycle === 'REBUILDING') {
        if (pos === 'RB' && age >= 27) {
            return { status: 'SELL', reason: 'Window Mismatch (Old RB)', color: 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px]' };
        }
        if (pos === 'WR' && age >= 29) {
            return { status: 'SELL', reason: 'Aging Asset on Rebuild', color: 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px]' };
        }
        if (age <= 24 && marketValue > 3000) {
            return { status: 'HOLD', reason: 'Core Rebuild Piece', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]' };
        }
    }

    // --- CONTENDER LOGIC ---
    if (teamLifecycle === 'CONTENDER') {
        // High value young players -> Usually HOLD, but if value is immense, maybe "SELL HIGH" isn't bad. Let's stick to HOLD.
        if (marketValue > 6000 && age <= 26) {
            return { status: 'HOLD', reason: 'Elite Asset', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]' };
        }
        // Aging producers with low market value but high production -> HOLD (Points)
        if ((pos === 'RB' && age >= 28) || (pos === 'WR' && age >= 30)) {
            if (marketValue < 4000) {
                return { status: 'HOLD', reason: 'Contender Production Window', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]' };
            } else {
                return { status: 'SELL HIGH', reason: 'Value > Production Window', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]' };
            }
        }
    }

    // --- FRINGE / GENERAL LOGIC ---
    if (marketValue < 500 && age >= 28 && !['QB', 'K', 'DEF'].includes(pos)) {
        return { status: 'DROP CANDIDATE', reason: 'Roster Clogger', color: 'bg-slate-700 text-slate-300 border-slate-600 text-[10px]' };
    }

    if (age <= 23 && marketValue > 4000) {
        return { status: 'CORE', reason: 'Foundation Asset', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]' };
    }

    return null; // Return null if no strong verdict applies
};

/**
 * Recommends trade assets when comparing two rosters.
 */
export const getTradeSuggestions = (rosterA, rosterB, assetsA, assetsB, allRosters) => {
    const lifecycleA = getTeamLifecycle(rosterA, allRosters);
    const lifecycleB = getTeamLifecycle(rosterB, allRosters);

    let suggestionsForA = []; // Assets A should target from B
    let suggestionsForB = []; // Assets B should target from A

    // If A is Rebuilding and B is Contending
    if (lifecycleA === 'REBUILDING' && lifecycleB === 'CONTENDER') {
        // A should target B's Picks and young players
        suggestionsForA = assetsB.filter(a => a.type === 'Pick' || (a.age <= 24 && !['K', 'DEF'].includes(a.position))).slice(0, 3);
        // B should target A's old producing veterans
        suggestionsForB = assetsA.filter(a => a.type !== 'Pick' && ((a.position === 'RB' && a.age >= 26) || (a.position === 'WR' && a.age >= 28))).slice(0, 3);
    } 
    // Vice versa
    else if (lifecycleB === 'REBUILDING' && lifecycleA === 'CONTENDER') {
        suggestionsForB = assetsA.filter(a => a.type === 'Pick' || (a.age <= 24 && !['K', 'DEF'].includes(a.position))).slice(0, 3);
        suggestionsForA = assetsB.filter(a => a.type !== 'Pick' && ((a.position === 'RB' && a.age >= 26) || (a.position === 'WR' && a.age >= 28))).slice(0, 3);
    } 
    // If both are contenders, they might need different positions
    else if (lifecycleA === 'CONTENDER' && lifecycleB === 'CONTENDER') {
       // Just suggest the highest value assets as blockbusters
       suggestionsForA = assetsB.filter(a => a.tradeValue > 4000).slice(0, 3);
       suggestionsForB = assetsA.filter(a => a.tradeValue > 4000).slice(0, 3);
    }

    return { targetsForA: suggestionsForA, targetsForB: suggestionsForB };
};
