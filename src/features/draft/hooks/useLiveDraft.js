import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchDraft, fetchDraftPicks, fetchLeagueDrafts } from '../../../utils/sleeper';
import { getOnTheClock } from '../../../utils/draftEngine';

/**
 * useLiveDraft — Custom hook for real-time draft tracking via smart polling.
 * 
 * Behavior:
 * - Auto-discovers the active/most-recent draft for the league
 * - If "drafting": polls picks every 4s, draft status every 15s
 * - If "pre_draft": polls draft status every 15s (watches for start)
 * - If "complete": no polling, static data
 * - Shows ~15 minutes before start_time
 * - Accepts overrideDraftId to display a specific draft (e.g., past seasons)
 * 
 * @param {string} leagueId
 * @param {string} userId - logged-in user's user_id 
 * @param {Object} players - full NFL players map
 * @param {string|null} overrideDraftId - optional: force display of a specific draft
 */
export function useLiveDraft(leagueId, userId, players, overrideDraftId = null) {
    // ─── Step 1: Discover drafts for this league ──────────────────────
    const { data: allDrafts, isLoading: loadingDrafts } = useQuery({
        queryKey: ['leagueDrafts', leagueId],
        queryFn: () => fetchLeagueDrafts(leagueId),
        enabled: !!leagueId,
        staleTime: 5 * 60 * 1000, // 5 min cache
    });

    // Auto-pick target draft when no override: live > pre-draft (within 15min) > completed
    const autoTargetDraftId = useMemo(() => {
        if (!allDrafts?.length) return null;

        // Priority 1: Currently drafting
        const drafting = allDrafts.find(d => d.status === 'drafting');
        if (drafting) return drafting.draft_id;

        // Priority 2: Pre-draft within 15 minutes of start
        const preDraft = allDrafts.find(d => {
            if (d.status !== 'pre_draft') return false;
            if (!d.start_time) return true;
            const msUntilStart = d.start_time - Date.now();
            return msUntilStart <= 15 * 60 * 1000;
        });
        if (preDraft) return preDraft.draft_id;

        // Priority 3: Most recent completed draft
        const completed = allDrafts.find(d => d.status === 'complete');
        if (completed) return completed.draft_id;

        // Fallback
        return allDrafts[0]?.draft_id || null;
    }, [allDrafts]);

    // Use override if provided, else auto-target
    const targetDraftId = overrideDraftId || autoTargetDraftId;

    // ─── Step 2: Fetch draft metadata (with conditional polling) ─────
    const { data: draft, isLoading: loadingDraft } = useQuery({
        queryKey: ['draft', targetDraftId],
        queryFn: () => fetchDraft(targetDraftId),
        enabled: !!targetDraftId,
        refetchInterval: (query) => {
            if (overrideDraftId) return false; // No polling for historical drafts
            const status = query.state?.data?.status;
            if (status === 'drafting') return 15_000;
            if (status === 'pre_draft') return 15_000;
            return false;
        },
        staleTime: 5000,
    });

    const draftStatus = draft?.status || null;
    const isLive = draftStatus === 'drafting';
    const isPreDraft = draftStatus === 'pre_draft';
    const isComplete = draftStatus === 'complete';

    // ─── Step 3: Fetch picks (aggressive polling when live) ──────────
    const { data: picks = [], isLoading: loadingPicks } = useQuery({
        queryKey: ['draftPicks', targetDraftId],
        queryFn: () => fetchDraftPicks(targetDraftId),
        enabled: !!targetDraftId && (isLive || isComplete),
        refetchInterval: isLive && !overrideDraftId ? 4000 : false,
        staleTime: isLive ? 2000 : 60_000,
    });

    // ─── Step 4: Compute derived state ───────────────────────────────
    const computed = useMemo(() => {
        if (!draft) return {};

        const totalTeams = draft.settings?.teams || 12;
        const totalRounds = draft.settings?.rounds || 15;
        const draftType = draft.type || 'snake';
        const draftOrder = draft.draft_order || {};
        const slotToRosterId = draft.slot_to_roster_id || {};

        const userDraftSlot = userId ? draftOrder[userId] : null;
        const userRosterId = userDraftSlot ? slotToRosterId[String(userDraftSlot)] : null;

        const otc = getOnTheClock(draftType, totalTeams, totalRounds, picks.length, draftOrder, slotToRosterId);
        const isUserOnTheClock = userRosterId && otc.rosterId === userRosterId;

        const userPicks = userRosterId 
            ? picks.filter(p => String(p.roster_id) === String(userRosterId))
            : [];

        const draftedPlayerIds = new Set(picks.map(p => p.player_id));

        let timeRemaining = null;
        if (isLive && draft.settings?.pick_timer && draft.last_picked) {
            const elapsed = (Date.now() - draft.last_picked) / 1000;
            const remaining = Math.max(0, draft.settings.pick_timer - elapsed);
            timeRemaining = Math.round(remaining);
        }

        let timeUntilStart = null;
        if (isPreDraft && draft.start_time) {
            timeUntilStart = Math.max(0, Math.round((draft.start_time - Date.now()) / 1000));
        }

        const rosterIdToUserId = {};
        Object.entries(draftOrder).forEach(([uid, slot]) => {
            const rid = slotToRosterId[String(slot)];
            if (rid) rosterIdToUserId[String(rid)] = uid;
        });

        return {
            totalTeams,
            totalRounds,
            draftType,
            draftOrder,
            slotToRosterId,
            userDraftSlot,
            userRosterId,
            onTheClock: otc,
            isUserOnTheClock,
            userPicks,
            draftedPlayerIds,
            timeRemaining,
            timeUntilStart,
            rosterIdToUserId,
        };
    }, [draft, picks, userId, isLive, isPreDraft]);

    // ─── Step 5: Determine visibility ────────────────────────────────
    const shouldShow = useMemo(() => {
        if (!draft) return false;
        if (overrideDraftId) return true; // User explicitly selected a draft
        if (isLive) return true;
        
        if (isPreDraft) {
            if (!draft.start_time) return true;
            const msUntilStart = draft.start_time - Date.now();
            return msUntilStart <= 15 * 60 * 1000;
        }
        
        // Always show completed drafts (recap view)
        if (isComplete) return true;

        return false;
    }, [draft, isLive, isPreDraft, isComplete, overrideDraftId]);

    return {
        draft,
        picks,
        allDrafts,
        targetDraftId,
        isLive,
        isPreDraft,
        isComplete,
        shouldShow,
        isLoading: loadingDrafts || loadingDraft || loadingPicks,
        ...computed,
    };
}
