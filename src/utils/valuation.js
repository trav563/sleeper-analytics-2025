/** Market providers approximate these settings; exact scoring stays in scoring.js. */
export function valuationSettings(league, teamCount) {
    const slots = league?.roster_positions || [];
    const numQbs = slots.filter(p => p === 'QB').length + slots.filter(p => p === 'SUPER_FLEX').length;
    return {
        isDynasty: [1, 2].includes(Number(league?.settings?.type)),
        numQbs: numQbs >= 2 ? 2 : 1,
        numTeams: teamCount || league?.total_rosters || league?.settings?.num_teams || 12,
        ppr: league?.scoring_settings?.rec ?? 0,
    };
}

export function ownedPlayerIds(roster) {
    return [...new Set([...(roster?.players || []), ...(roster?.reserve || []), ...(roster?.taxi || [])])];
}

export function tradeWindowOpen(league, state) {
    if (Number(league?.season) < Number(state?.season)) return false;
    if (!['regular', 'post'].includes(state?.season_type)) return true;
    const deadline = Number(league?.settings?.trade_deadline);
    return !deadline || Number(state?.week ?? state?.display_week ?? 0) <= deadline;
}
