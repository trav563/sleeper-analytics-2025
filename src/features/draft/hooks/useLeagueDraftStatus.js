import { useQuery } from '@tanstack/react-query';
import { fetchLeague, fetchDraft, fetchLeagueDrafts } from '../../../utils/sleeper';

/**
 * Lightweight live-status check for the current league's draft. Used by
 * the Navbar (LIVE pulse on the Draft tab) and the Dashboard (LIVE
 * banner). Shares React Query cache keys with `useDraft` so visiting
 * the Draft page warms the navbar's data and vice versa.
 */
export function useLeagueDraftStatus(leagueId) {
    const { data: league } = useQuery({
        queryKey: ['league', leagueId],
        queryFn: () => fetchLeague(leagueId),
        enabled: !!leagueId,
        staleTime: 60 * 60 * 1000,
    });

    const directDraftId = league?.draft_id || null;
    const { data: drafts } = useQuery({
        queryKey: ['leagueDrafts', leagueId],
        queryFn: () => fetchLeagueDrafts(leagueId),
        enabled: !!leagueId && !directDraftId,
        staleTime: 60 * 60 * 1000,
    });

    const draftId = directDraftId || drafts?.[0]?.draft_id || null;

    const { data: draft } = useQuery({
        queryKey: ['draft', draftId],
        queryFn: () => fetchDraft(draftId),
        enabled: !!draftId,
        staleTime: 60 * 1000,
        // Stop polling once the draft is complete.
        refetchInterval: (q) => {
            const s = q.state.data?.status;
            if (s === 'complete') return false;
            return 60 * 1000;
        },
    });

    const status = draft?.status;
    const isLive = status === 'drafting' || status === 'paused';
    const isPreDraft = status === 'pre_draft';
    const numTeams = draft?.settings?.teams || draft?.settings?.num_teams || 0;
    const totalRounds = draft?.settings?.rounds || 0;
    const totalPicks = numTeams * totalRounds;

    return { draftId, status, isLive, isPreDraft, totalPicks };
}
