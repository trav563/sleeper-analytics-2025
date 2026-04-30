import { useQuery } from '@tanstack/react-query';
import { fetchDraft, fetchLeagueDrafts } from '../../../utils/sleeper';
import { usePageVisibility } from './usePageVisibility';

/**
 * Resolve a draft id from either a direct id or a league. Falls back to the
 * most recent draft for the league when `league.draft_id` is missing.
 */
export function useResolvedDraftId({ leagueId, league }) {
    const directId = league?.draft_id || null;

    const { data: drafts } = useQuery({
        queryKey: ['leagueDrafts', leagueId],
        queryFn: () => fetchLeagueDrafts(leagueId),
        enabled: !!leagueId && !directId,
        staleTime: 60 * 60 * 1000,
    });

    if (directId) return directId;
    if (!drafts || drafts.length === 0) return null;
    // Sleeper returns drafts sorted newest-first
    return drafts[0]?.draft_id || null;
}

/**
 * Poll draft metadata. Cadence tightens as the start time approaches and
 * during live play; stops once complete.
 */
export function useDraft(draftId) {
    const visible = usePageVisibility();

    return useQuery({
        queryKey: ['draft', draftId],
        queryFn: () => fetchDraft(draftId),
        enabled: !!draftId && visible,
        refetchInterval: (query) => {
            if (!visible) return false;
            const data = query.state.data;
            if (!data) return 30 * 1000;
            const status = data.status;
            if (status === 'complete') return false;
            if (status === 'drafting' || status === 'paused') return 15 * 1000;
            // pre_draft — tighten as start_time approaches
            const start = Number(data.start_time) || 0;
            if (!start) return 60 * 1000;
            const msToStart = start - Date.now();
            if (msToStart <= 5 * 60 * 1000) return 10 * 1000;  // <5min
            if (msToStart <= 60 * 60 * 1000) return 30 * 1000; // <1h
            return 60 * 1000;
        },
        staleTime: 5 * 1000,
        refetchOnWindowFocus: true,
    });
}
