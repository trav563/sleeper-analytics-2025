/**
 * Resolves the *current* owner (roster_id) of any pick in the draft,
 * applying tradedPicks overrides on top of the original slot ownership.
 *
 * Sleeper's traded_picks endpoint returns entries like:
 *   { season, round, roster_id (original owner), owner_id (current owner),
 *     previous_owner_id }
 * roster_id, owner_id, previous_owner_id are all roster_ids despite the naming.
 * `owner_id` is always the latest current owner, so multi-hop trades resolve
 * correctly without us walking the chain.
 */
export function buildOwnership({ draft, tradedPicks }) {
    const slotToRoster = draft?.slot_to_roster_id || {};
    const draftSeason = String(draft?.season || '');

    const trades = (tradedPicks || []).filter(
        (t) => String(t?.season || '') === draftSeason
    );

    // overrides[round][originalOwnerRosterId] = currentOwnerRosterId
    const overrides = {};
    for (const t of trades) {
        if (!overrides[t.round]) overrides[t.round] = {};
        overrides[t.round][t.roster_id] = t.owner_id;
    }

    const numTeams = Number(draft?.settings?.teams || draft?.settings?.num_teams || 0);
    const totalRounds = Number(draft?.settings?.rounds || 0);
    const isSnake = draft?.type !== 'linear';

    function originalOwnerForSlot(slot) {
        return slotToRoster[slot] ?? null;
    }

    function currentOwnerForSlotRound(slot, round) {
        const originalOwner = originalOwnerForSlot(slot);
        if (originalOwner == null) return null;
        return overrides[round]?.[originalOwner] ?? originalOwner;
    }

    function slotForPick(pickNo) {
        if (!pickNo || !numTeams) return null;
        const round = Math.ceil(pickNo / numTeams);
        const posInRound = ((pickNo - 1) % numTeams) + 1;
        return isSnake && round % 2 === 0
            ? numTeams - posInRound + 1
            : posInRound;
    }

    function currentOwnerForPickNo(pickNo) {
        const slot = slotForPick(pickNo);
        if (slot == null) return null;
        const round = Math.ceil(pickNo / numTeams);
        return currentOwnerForSlotRound(slot, round);
    }

    function pickNosOwnedBy(rosterId, fromPickNo = 1) {
        const out = [];
        if (!rosterId || !numTeams || !totalRounds) return out;
        const total = numTeams * totalRounds;
        for (let pn = fromPickNo; pn <= total; pn++) {
            if (currentOwnerForPickNo(pn) === rosterId) out.push(pn);
        }
        return out;
    }

    return {
        originalOwnerForSlot,
        currentOwnerForSlotRound,
        currentOwnerForPickNo,
        pickNosOwnedBy,
        slotForPick,
        numTeams,
        totalRounds,
    };
}
