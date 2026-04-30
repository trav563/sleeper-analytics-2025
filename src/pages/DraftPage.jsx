import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Calendar } from 'lucide-react';
import { useResolvedDraftId, useDraft } from '../features/draft/hooks/useDraft';
import { useDraftPicks } from '../features/draft/hooks/useDraftPicks';
import { useDraftMode } from '../features/draft/hooks/useDraftMode';
import { useOnTheClock } from '../features/draft/hooks/useOnTheClock';
import { useDraftQueue } from '../features/draft/hooks/useDraftQueue';
import { useMarketValues } from '../features/draft/hooks/useMarketValues';
import { useBestAvailable } from '../features/draft/hooks/useBestAvailable';
import { useSniperAlerts } from '../features/draft/hooks/useSniperAlerts';
import { detectDraftType, draftTypeLabel } from '../features/draft/utils/draftTypeDetect';
import PreDraftView from '../features/draft/components/PreDraftView';
import LiveDraftView from '../features/draft/components/LiveDraftView';
import PostDraftView from '../features/draft/components/PostDraftView';
import SniperToastHost from '../features/draft/components/SniperToastHost';

export default function DraftPage() {
    const { league, rosters, users, players, user } = useOutletContext();
    const userId = user?.user_id;
    const leagueId = league?.league_id;

    const draftId = useResolvedDraftId({ leagueId, league });
    const { data: draft, isLoading: draftLoading, error: draftError } = useDraft(draftId);
    const { data: picks } = useDraftPicks(draftId, draft?.status);

    const draftType = useMemo(
        () => (draft && league ? detectDraftType(draft, league, rosters) : 'startup'),
        [draft, league, rosters]
    );

    const { mode } = useDraftMode(draft);
    const clock = useOnTheClock({ draft, picks, userId });

    const queueState = useDraftQueue(draftId);
    const marketValues = useMarketValues({ league });

    const [positionFilter, setPositionFilter] = useState('ALL');

    const availablePlayers = useBestAvailable({
        players,
        picks,
        marketValues,
        rosters,
        draftType,
        positionFilter,
        limit: 200,
    });

    // Full ranked pool (for scarcity heatmap baseline)
    const fullRanked = useBestAvailable({
        players,
        picks: [],
        marketValues,
        rosters: [],
        draftType,
        positionFilter: 'ALL',
        limit: 500,
    });

    const { alerts, dismiss } = useSniperAlerts({
        picks,
        isQueued: queueState.isQueued,
        players,
    });

    if (!leagueId) {
        return <p className="text-muted-foreground">Load a league to use the Draft Assistant.</p>;
    }

    if (!draftId && !draftLoading) {
        return (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-8 text-center">
                <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h2 className="text-xl font-semibold mb-1">No draft scheduled</h2>
                <p className="text-sm text-muted-foreground">
                    This league doesn't have an active draft right now.
                </p>
            </div>
        );
    }

    if (draftLoading || !draft) {
        return (
            <div className="flex justify-center items-center py-20 text-muted-foreground animate-pulse">
                Loading draft…
            </div>
        );
    }

    if (draftError) {
        return (
            <div className="text-rose-400 p-4">
                Failed to load draft: {String(draftError.message || draftError)}
            </div>
        );
    }

    if (draft.type === 'auction') {
        return (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-8 text-center">
                <h2 className="text-xl font-semibold mb-1">Auction drafts coming soon</h2>
                <p className="text-sm text-muted-foreground">
                    The Live Draft Assistant currently supports snake and linear drafts.
                </p>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Draft Assistant · {league?.name || 'League'}</title>
            </Helmet>

            <SniperToastHost alerts={alerts} onDismiss={dismiss} />

            {mode === 'scheduled' && (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-8 text-center">
                    <Calendar className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                    <h2 className="text-2xl font-semibold mb-2">Draft scheduled</h2>
                    <p className="text-sm text-muted-foreground mb-1">
                        {draftTypeLabel(draftType)} starts {new Date(Number(draft.start_time)).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                        The Live Draft Assistant unlocks 24 hours before the draft.
                    </p>
                </div>
            )}

            {mode === 'pre' && (
                <PreDraftView
                    draft={draft}
                    league={league}
                    picks={picks}
                    players={players}
                    rosters={rosters}
                    users={users}
                    userId={userId}
                    draftType={draftType}
                    availablePlayers={availablePlayers}
                    fullRanked={fullRanked}
                    queueState={queueState}
                    positionFilter={positionFilter}
                    onPositionFilter={setPositionFilter}
                />
            )}

            {mode === 'live' && (
                <LiveDraftView
                    draft={draft}
                    draftId={draftId}
                    league={league}
                    leagueId={leagueId}
                    picks={picks}
                    players={players}
                    rosters={rosters}
                    users={users}
                    userId={userId}
                    draftType={draftType}
                    clock={clock}
                    availablePlayers={availablePlayers}
                    fullRanked={fullRanked}
                    queueState={queueState}
                    positionFilter={positionFilter}
                    onPositionFilter={setPositionFilter}
                />
            )}

            {mode === 'post' && (
                <PostDraftView
                    draft={draft}
                    picks={picks}
                    players={players}
                    rosters={rosters}
                    users={users}
                    userId={userId}
                    draftType={draftType}
                />
            )}

            {mode === 'unknown' && (
                <p className="text-muted-foreground">Unknown draft state.</p>
            )}
        </>
    );
}
