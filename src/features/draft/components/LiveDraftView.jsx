import OnTheClockBanner from './OnTheClockBanner';
import BestAvailableList from './BestAvailableList';
import MyDraftRoster from './MyDraftRoster';
import RecentPicksFeed from './RecentPicksFeed';
import PositionScarcityHeatmap from './PositionScarcityHeatmap';
import QueueManager from './QueueManager';
import AIRecommender from './AIRecommender';
import DraftOrderGrid from './DraftOrderGrid';
import TeamNeeds from './TeamNeeds';

export default function LiveDraftView({
    draft, draftId, leagueId, picks, players, rosters, users, userId, userRoster,
    draftType, clock, availablePlayers, fullRanked, queueState,
    positionFilter, onPositionFilter,
    teamNeeds, trendingMap,
    bestMode, onBestModeChange,
    onPlayerClick,
}) {
    const hasRoster = !!userRoster && (userRoster.players?.length || 0) > 0;

    return (
        <div className="space-y-6">
            <OnTheClockBanner clock={clock} rosters={rosters} users={users} />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Left: AI + Team Needs + my picks + queue */}
                <div className="xl:col-span-3 space-y-6">
                    <AIRecommender
                        draftId={draftId}
                        leagueId={leagueId}
                        userId={userId}
                        pickNo={clock?.pickNo}
                        isMyTurn={!!clock?.isMyTurn}
                        draftType={draftType}
                        picksUntilMine={clock?.picksUntilMine}
                    />
                    <TeamNeeds
                        teamNeeds={teamNeeds}
                        hasRoster={hasRoster}
                        availablePlayers={availablePlayers}
                        onPlayerClick={onPlayerClick}
                    />
                    <MyDraftRoster
                        picks={picks}
                        players={players}
                        userSlot={clock?.userSlot}
                        draftType={draftType}
                        onPlayerClick={onPlayerClick}
                    />
                    <QueueManager
                        queue={queueState.queue}
                        players={players}
                        picks={picks}
                        onToggle={queueState.toggle}
                        onClear={queueState.clear}
                        onPlayerClick={onPlayerClick}
                    />
                </div>

                {/* Center: Best available */}
                <div className="xl:col-span-6 min-w-0">
                    <BestAvailableList
                        availablePlayers={availablePlayers}
                        positionFilter={positionFilter}
                        onPositionFilter={onPositionFilter}
                        isQueued={queueState.isQueued}
                        onToggleQueue={queueState.toggle}
                        onPlayerClick={onPlayerClick}
                        showRookieOnlyHint={draftType === 'rookie'}
                        mode={bestMode}
                        onModeChange={onBestModeChange}
                        trendingMap={trendingMap}
                        teamWeights={teamNeeds?.weights}
                    />
                </div>

                {/* Right: Scarcity + recent picks */}
                <div className="xl:col-span-3 space-y-6">
                    <PositionScarcityHeatmap
                        availablePlayers={availablePlayers}
                        fullRanked={fullRanked}
                    />
                    <RecentPicksFeed
                        picks={picks}
                        players={players}
                        rosters={rosters}
                        users={users}
                        userSlot={clock?.userSlot}
                        onPlayerClick={onPlayerClick}
                    />
                </div>
            </div>

            <DraftOrderGrid
                draft={draft}
                picks={picks}
                rosters={rosters}
                users={users}
                userId={userId}
                currentPickNo={clock?.pickNo}
            />
        </div>
    );
}
