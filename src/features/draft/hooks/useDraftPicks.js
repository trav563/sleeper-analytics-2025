import { useQuery } from '@tanstack/react-query';
import { fetchDraftPicks } from '../../../utils/sleeper';
import { usePageVisibility } from './usePageVisibility';

/**
 * Poll draft picks. 3 s during live drafting, off otherwise.
 */
export function useDraftPicks(draftId, draftStatus) {
    const visible = usePageVisibility();
    const isLive = draftStatus === 'drafting' || draftStatus === 'paused';

    return useQuery({
        queryKey: ['draftPicks', draftId],
        queryFn: () => fetchDraftPicks(draftId),
        enabled: !!draftId && visible,
        refetchInterval: (query) => {
            if (!visible) return false;
            if (isLive) return 3 * 1000;
            // After complete: fetch once, never again. Pre-draft: fetch once to seed empty array.
            return query.state.data ? false : 30 * 1000;
        },
        staleTime: isLive ? 1 * 1000 : 60 * 60 * 1000,
        refetchOnWindowFocus: isLive,
    });
}
