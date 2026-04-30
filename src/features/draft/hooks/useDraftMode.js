/**
 * Maps a Sleeper draft status into a UI mode the dashboard switches on.
 * Pre-draft is gated to the 24 hours before start_time; before that we still
 * show the dashboard but in a "scheduled" state.
 */
export function useDraftMode(draft) {
    if (!draft) return { mode: 'unknown', msToStart: 0 };

    const status = draft.status;
    const startTime = Number(draft.start_time) || 0;
    const msToStart = startTime - Date.now();

    if (status === 'complete') return { mode: 'post', msToStart };
    if (status === 'drafting' || status === 'paused') return { mode: 'live', msToStart };
    // pre_draft
    if (msToStart > 24 * 60 * 60 * 1000) return { mode: 'scheduled', msToStart };
    return { mode: 'pre', msToStart };
}
