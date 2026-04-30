import { useEffect, useState } from 'react';

/**
 * For a given pick number on a snake draft, return the draft slot (1-indexed)
 * that owns it.
 */
export function slotForPick(pickNo, numTeams) {
    if (!pickNo || !numTeams) return null;
    const round = Math.ceil(pickNo / numTeams);
    const posInRound = ((pickNo - 1) % numTeams) + 1;
    return round % 2 === 1 ? posInRound : numTeams - posInRound + 1;
}

/**
 * For a given slot, return the pick number it owns in a specific round.
 */
export function pickNoForSlot(slot, round, numTeams) {
    if (!slot || !round || !numTeams) return null;
    return round % 2 === 1
        ? (round - 1) * numTeams + slot
        : (round - 1) * numTeams + (numTeams - slot + 1);
}

/**
 * Returns the *next* pick number a slot owns at or after `currentPickNo`.
 */
export function nextPickForSlot(slot, currentPickNo, numTeams, totalRounds) {
    if (!slot || !numTeams) return null;
    const startRound = Math.ceil(currentPickNo / numTeams);
    for (let r = startRound; r <= totalRounds; r++) {
        const pn = pickNoForSlot(slot, r, numTeams);
        if (pn >= currentPickNo) return pn;
    }
    return null;
}

/**
 * Live ticker for draft state — current pick #, round, whose turn it is,
 * time remaining, whether it's the logged-in user's turn.
 */
export function useOnTheClock({ draft, picks, userId }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!draft || draft.status !== 'drafting') return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [draft]);

    if (!draft) return null;

    const numTeams = draft.settings?.teams || draft.settings?.num_teams || 12;
    const totalRounds = draft.settings?.rounds || 0;
    const pickTimerSec = draft.settings?.pick_timer || 0;
    const draftOrder = draft.draft_order || {};         // user_id -> slot
    const slotToRoster = draft.slot_to_roster_id || {}; // slot -> roster_id

    const picksMade = picks?.length || 0;
    const pickNo = picksMade + 1;
    const round = Math.ceil(pickNo / numTeams);
    const posInRound = ((pickNo - 1) % numTeams) + 1;

    const isComplete = totalRounds > 0 && pickNo > totalRounds * numTeams;
    if (isComplete) {
        return { isComplete: true, pickNo: null, round: null, currentSlot: null };
    }

    const currentSlot = slotForPick(pickNo, numTeams);
    const currentRosterId = slotToRoster[currentSlot] || null;

    const userSlot = userId ? draftOrder[userId] : null;
    const isMyTurn = !!userSlot && userSlot === currentSlot;

    // Time-on-clock math
    const lastPicked = Number(draft.last_picked) || 0;
    const startTime = Number(draft.start_time) || 0;
    const baseTs = lastPicked > 0 ? lastPicked : startTime;
    const expiresAt = pickTimerSec > 0 && baseTs > 0
        ? baseTs + pickTimerSec * 1000
        : null;
    const msLeft = expiresAt ? Math.max(0, expiresAt - now) : null;
    const isPaused = draft.status === 'paused';

    // What's my next pick?
    const myNextPick = userSlot
        ? nextPickForSlot(userSlot, pickNo, numTeams, totalRounds)
        : null;
    const picksUntilMine = myNextPick ? myNextPick - pickNo : null;

    return {
        isComplete: false,
        pickNo,
        round,
        posInRound,
        numTeams,
        totalRounds,
        currentSlot,
        currentRosterId,
        userSlot,
        isMyTurn,
        myNextPick,
        picksUntilMine,
        msLeft,
        pickTimerSec,
        isPaused,
    };
}
