import { Clock, Trophy, Pause } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { displayTeamName } from '../../../utils/nflData';

function formatTimer(msLeft) {
    if (msLeft == null) return '—';
    const totalSec = Math.max(0, Math.ceil(msLeft / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function OnTheClockBanner({ clock, rosters, users }) {
    if (!clock) return null;
    if (clock.isComplete) {
        return (
            <div className="rounded-2xl border border-good/40 bg-gradient-to-r from-good/30 to-good/20 p-6 flex items-center gap-4">
                <Trophy className="w-10 h-10 text-good" />
                <div>
                    <h2 className="text-2xl font-bold text-good">Draft Complete</h2>
                    <p className="text-sm text-good/80">All picks are in.</p>
                </div>
            </div>
        );
    }

    const roster = rosters?.find((r) => r.roster_id === clock.currentRosterId);
    const owner = roster ? users?.find((u) => u.user_id === roster.owner_id) : null;
    const ownerName = owner ? displayTeamName(owner) : `Team ${clock.currentRosterId ?? '?'}`;

    const isLow = clock.msLeft != null && clock.msLeft < 15_000;
    const isWarn = !isLow && clock.msLeft != null && clock.msLeft < 30_000;

    return (
        <div
            className={cn(
                'rounded-2xl border p-6 transition-colors',
                clock.isMyTurn
                    ? 'border-signal bg-gradient-to-r from-signal/40 to-signal/20 animate-pulse'
                    : 'border-line bg-bg-2'
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div
                        className={cn(
                            'h-14 w-14 rounded-xl flex items-center justify-center text-xl font-bold',
                            clock.isMyTurn
                                ? 'bg-signal text-bg'
                                : 'bg-bg-3 text-text'
                        )}
                    >
                        {clock.pickNo}
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-wider text-text-mute">
                            Round {clock.round} · Pick {clock.posInRound} of {clock.numTeams}
                        </p>
                        <h2 className="text-2xl font-bold">
                            {clock.isMyTurn ? 'You are on the clock' : `${ownerName} on the clock`}
                        </h2>
                        {!clock.isMyTurn && clock.myNextPick && (
                            <p className="text-sm text-text-mute mt-0.5">
                                Your next pick: #{clock.myNextPick} ({clock.picksUntilMine} away)
                            </p>
                        )}
                    </div>
                </div>

                <div className="text-right">
                    {clock.isPaused ? (
                        <div className="flex items-center gap-2 text-warn">
                            <Pause className="w-5 h-5" />
                            <span className="font-semibold">Paused</span>
                        </div>
                    ) : clock.pickTimerSec === 0 ? (
                        <div className="text-sm text-text-mute">No pick timer</div>
                    ) : (
                        <div
                            className={cn(
                                'flex items-center gap-2 font-mono text-3xl tnum',
                                isLow ? 'text-red-400' : isWarn ? 'text-signal' : 'text-foreground'
                            )}
                        >
                            <Clock className="w-6 h-6" />
                            {formatTimer(clock.msLeft)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
