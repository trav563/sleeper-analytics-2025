/**
 * Classify a draft so the UI and AI prompt can adapt:
 *   'rookie'         — small rookie/keeper draft for a continuing dynasty league
 *   'startup'        — full-roster startup draft (fresh league or empty rosters)
 *   'annual_redraft' — yearly redraft of an established league
 *
 * @param {object} draft   - Sleeper draft object (settings, etc.)
 * @param {object} league  - Sleeper league object
 * @param {Array}  rosters - league rosters
 * @returns {'rookie'|'startup'|'annual_redraft'}
 */
export const detectDraftType = (draft, league, rosters = []) => {
    if (!draft || !league) return 'startup';

    const rounds = draft?.settings?.rounds ?? draft?.settings?.draft_rounds ?? 0;
    const hasPrevLeague = !!league.previous_league_id;
    const rostersHavePlayers = rosters.some(r => (r.players || []).length > 0);

    if (rounds <= 5 && hasPrevLeague && rostersHavePlayers) return 'rookie';
    if (!hasPrevLeague || !rostersHavePlayers) return 'startup';
    return 'annual_redraft';
};

export const draftTypeLabel = (type) => {
    switch (type) {
        case 'rookie': return 'Rookie / Keeper Draft';
        case 'startup': return 'Startup Draft';
        case 'annual_redraft': return 'Annual Redraft';
        default: return 'Draft';
    }
};

/**
 * Positions actually drafted in this draft type. Rookie/keeper drafts
 * skip K and DEF — those slots are filled via waivers, not the draft.
 */
export const getDraftablePositions = (draftType) => {
    if (draftType === 'rookie') return ['QB', 'RB', 'WR', 'TE'];
    return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
};
