import { useEffect, useState } from 'react';
import { Calendar, Clock, Trophy } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import DraftOrderGrid from './DraftOrderGrid';
import BestAvailableList from './BestAvailableList';
import QueueManager from './QueueManager';
import TeamNeeds from './TeamNeeds';
import { draftTypeLabel } from '../utils/draftTypeDetect';

function formatCountdown(ms) {
    if (ms <= 0) return 'Starting now';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatLocal(ts) {
    if (!ts) return 'TBD';
    return new Date(ts).toLocaleString([], {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

export default function PreDraftView({
    draft, picks, players, rosters, users, userId, userRoster,
    draftType, availablePlayers, queueState,
    positionFilter, onPositionFilter,
    teamNeeds, trendingMap,
    bestMode, onBestModeChange,
    onPlayerClick,
}) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const startTs = Number(draft?.start_time) || 0;
    const msToStart = startTs - now;
    const numTeams = draft?.settings?.teams || draft?.settings?.num_teams || 12;
    const totalRounds = draft?.settings?.rounds || 0;
    const userSlot = userId ? draft?.draft_order?.[userId] : null;

    return (
        <div className="space-y-6">
            {/* Countdown banner */}
            <div className="rounded-2xl border border-signal/30 bg-gradient-to-r from-signal/30 to-bg-1/30 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Badge variant="outline" className="mb-2">{draftTypeLabel(draftType)}</Badge>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-signal" />
                            Draft starts in {formatCountdown(msToStart)}
                        </h2>
                        <p className="text-sm text-text-mute mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatLocal(startTs)}
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-text-mute">Teams</p>
                            <p className="text-2xl font-bold">{numTeams}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-text-mute">Rounds</p>
                            <p className="text-2xl font-bold">{totalRounds}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-text-mute">Your Slot</p>
                            <p className="text-2xl font-bold text-signal">{userSlot || '—'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
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
                <div className="space-y-6">
                    <TeamNeeds
                        teamNeeds={teamNeeds}
                        hasRoster={!!userRoster && (userRoster.players?.length || 0) > 0}
                        availablePlayers={availablePlayers}
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
                    <div className="rounded-xl border border-line bg-bg-1 p-4">
                        <h3 className="text-base font-semibold flex items-center gap-2 mb-2 text-text">
                            <Clock className="w-4 h-4" />
                            Pre-Draft Tips
                        </h3>
                        <ul className="text-sm text-text-mute space-y-1.5 list-disc list-inside">
                            <li>Star players in Best Available to build a queue.</li>
                            <li>Click a player's name to see news and stats.</li>
                            <li>Toggle "Best for My Team" to weight by your roster needs.</li>
                            <li>The dashboard auto-switches to live mode when the draft starts.</li>
                            <li>Your queue is saved per-draft.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <DraftOrderGrid
                draft={draft}
                picks={picks}
                rosters={rosters}
                users={users}
                userId={userId}
                currentPickNo={1}
            />
        </div>
    );
}
