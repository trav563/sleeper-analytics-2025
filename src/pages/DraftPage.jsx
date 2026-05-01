import { useCallback, useMemo, useState } from 'react';
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
import { useTeamNeeds } from '../features/draft/hooks/useTeamNeeds';
import { useTrendingAdds } from '../features/draft/hooks/useTrendingAdds';
import { detectDraftType, draftTypeLabel } from '../features/draft/utils/draftTypeDetect';
import PreDraftView from '../features/draft/components/PreDraftView';
import LiveDraftView from '../features/draft/components/LiveDraftView';
import PostDraftView from '../features/draft/components/PostDraftView';
import SniperToastHost from '../features/draft/components/SniperToastHost';
import PlayerDetailDialog from '../features/draft/components/PlayerDetailDialog';

export default function DraftPage() {
    const { league, rosters, users, players, user, tradedPicks } = useOutletContext();
    const userId = user?.user_id;
    const leagueId = league?.league_id;

    const draftId = useResolvedDraftId({ leagueId, league });
    const { data: draft, isLoading: draftLoading, error: draftError } = useDraft(draftId);
    const { data: picks } = useDraftPicks(draftId, draft?.status);

    const draftType = useMemo(
        () => (draft && league ? detectDraftType(draft, league, rosters) : 'startup'),
        [draft, league, rosters]
    );

    const userRoster = useMemo(
        () => rosters?.find((r) => r.owner_id === userId) || null,
        [rosters, userId]
    );
    const userRosterId = userRoster?.roster_id ?? null;

    const { mode } = useDraftMode(draft);
    const clock = useOnTheClock({ draft, picks, userId, userRosterId, tradedPicks });

    const queueState = useDraftQueue(draftId);
    const marketValues = useMarketValues({ league, players });
    const { idMap: trendingMap } = useTrendingAdds();
    const teamNeeds = useTeamNeeds({ league, userRoster, rosters, players, marketValues, draftType });

    const [positionFilter, setPositionFilter] = useState('ALL');
    const [bestMode, setBestMode] = useState('bpa');
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    const onPlayerClick = useCallback((p) => setSelectedPlayer(p), []);
    const onClosePlayer = useCallback(() => setSelectedPlayer(null), []);

    const availablePlayers = useBestAvailable({
        players,
        picks,
        marketValues,
        rosters,
        draftType,
        positionFilter,
        limit: 200,
        teamWeights: teamNeeds?.weights,
        mode: bestMode,
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
        return <p className="text-text-mute">Load a league to use the Draft Assistant.</p>;
    }

    if (!draftId && !draftLoading) {
        return (
            <div className="rounded-xl border border-line bg-bg-1 p-8 text-center">
                <Calendar className="w-10 h-10 text-text-mute mx-auto mb-3" />
                <h2 className="text-xl font-semibold mb-1 text-text">No draft scheduled</h2>
                <p className="text-sm text-text-mute">
                    This league doesn't have an active draft right now.
                </p>
            </div>
        );
    }

    if (draftLoading || !draft) {
        return (
            <div className="flex justify-center items-center py-20 text-text-mute animate-pulse">
                Loading draft…
            </div>
        );
    }

    if (draftError) {
        return (
            <div className="text-bad p-4">
                Failed to load draft: {String(draftError.message || draftError)}
            </div>
        );
    }

    if (draft.type === 'auction') {
        return (
            <div className="rounded-xl border border-line bg-bg-1 p-8 text-center">
                <h2 className="text-xl font-semibold mb-1 text-text">Auction drafts coming soon</h2>
                <p className="text-sm text-text-mute">
                    The Live Draft Assistant currently supports snake and linear drafts.
                </p>
            </div>
        );
    }

    const sharedProps = {
        draft, league, picks, players, rosters, users, userId, userRoster, userRosterId,
        tradedPicks, draftType,
        availablePlayers, queueState, positionFilter,
        onPositionFilter: setPositionFilter,
        teamNeeds, trendingMap,
        bestMode, onBestModeChange: setBestMode,
        onPlayerClick,
    };

    return (
        <>
            <Helmet>
                <title>Draft Assistant · {league?.name || 'League'}</title>
            </Helmet>

            <SniperToastHost alerts={alerts} onDismiss={dismiss} />

            <PlayerDetailDialog
                selected={selectedPlayer}
                players={players}
                onClose={onClosePlayer}
                onToggleQueue={queueState.toggle}
                isQueued={queueState.isQueued}
            />

            {mode === 'scheduled' && (
                <div className="rounded-2xl border border-line bg-bg-1 p-8 text-center">
                    <Calendar className="w-10 h-10 text-signal mx-auto mb-3" />
                    <h2 className="text-2xl font-semibold mb-2 text-text">Draft scheduled</h2>
                    <p className="text-sm text-text-mute mb-1">
                        {draftTypeLabel(draftType)} starts {new Date(Number(draft.start_time)).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-mute/80">
                        The Live Draft Assistant unlocks 24 hours before the draft.
                    </p>
                </div>
            )}

            {mode === 'pre' && <PreDraftView {...sharedProps} />}

            {mode === 'live' && (
                <LiveDraftView
                    {...sharedProps}
                    draftId={draftId}
                    leagueId={leagueId}
                    clock={clock}
                    fullRanked={fullRanked}
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
                    userRosterId={userRosterId}
                    tradedPicks={tradedPicks}
                    draftType={draftType}
                    onPlayerClick={onPlayerClick}
                />
            )}

            {mode === 'unknown' && (
                <p className="text-text-mute">Unknown draft state.</p>
            )}
        </>
    );
}
