import { useEffect, useState } from 'react';
import { Calendar, Clock, Trophy } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import DraftOrderGrid from './DraftOrderGrid';
import BestAvailableList from './BestAvailableList';
import QueueManager from './QueueManager';
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
    draft, picks, players, rosters, users, userId,
    draftType, availablePlayers, queueState,
    positionFilter, onPositionFilter,
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
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-900/30 to-slate-900/30 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Badge variant="outline" className="mb-2">{draftTypeLabel(draftType)}</Badge>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-amber-400" />
                            Draft starts in {formatCountdown(msToStart)}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatLocal(startTs)}
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Teams</p>
                            <p className="text-2xl font-bold">{numTeams}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rounds</p>
                            <p className="text-2xl font-bold">{totalRounds}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Slot</p>
                            <p className="text-2xl font-bold text-amber-400">{userSlot || '—'}</p>
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
                        showRookieOnlyHint={draftType === 'rookie'}
                    />
                </div>
                <div className="space-y-6">
                    <QueueManager
                        queue={queueState.queue}
                        players={players}
                        picks={picks}
                        onToggle={queueState.toggle}
                        onClear={queueState.clear}
                    />
                    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
                        <h3 className="text-base font-semibold flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4" />
                            Pre-Draft Tips
                        </h3>
                        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                            <li>Star players in the Best Available list to build a queue.</li>
                            <li>The dashboard switches to live mode automatically when the draft starts.</li>
                            <li>AI recommendations auto-fire when it's your turn.</li>
                            <li>Closing this tab is fine — your queue is saved per-draft.</li>
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
