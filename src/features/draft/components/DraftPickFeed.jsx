import { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Zap, User } from 'lucide-react';
import { playerHeadshotUrl, displayTeamName } from '../../../utils/nflData';
import { getPositionColor } from '../../../utils/draftEngine';

/**
 * DraftPickFeed — Scrolling live feed of draft picks with on-the-clock indicator.
 */
const DraftPickFeed = ({ picks = [], users = [], draft, onTheClock, isUserOnTheClock, timeRemaining, userRosterId, rosterIdToUserId, isLive }) => {
    const feedRef = useRef(null);

    // Auto-scroll to latest pick
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = 0;
        }
    }, [picks.length]);

    // Reverse so newest is at top
    const recentPicks = useMemo(() => {
        return [...picks].reverse().slice(0, 30);
    }, [picks]);

    const getUserForRoster = (rosterId) => {
        const uid = rosterIdToUserId?.[String(rosterId)];
        return users.find(u => u.user_id === uid);
    };

    const formatTime = (seconds) => {
        if (seconds == null) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const otcUser = onTheClock?.rosterId ? getUserForRoster(onTheClock.rosterId) : null;

    return (
        <div className="flex flex-col h-full">
            {/* On The Clock Banner */}
            {isLive && onTheClock && !onTheClock.isDraftComplete && (
                <div className={`rounded-lg p-3 mb-3 border transition-all duration-500 ${
                    isUserOnTheClock 
                        ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10' 
                        : 'bg-gradient-to-r from-amber-500/15 to-amber-600/5 border-amber-500/30'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-full ${isUserOnTheClock ? 'bg-emerald-500/30' : 'bg-amber-500/20'}`}>
                                {isUserOnTheClock ? <Zap className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-amber-400" />}
                            </div>
                            <div>
                                <p className={`text-xs font-bold uppercase tracking-wider ${isUserOnTheClock ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {isUserOnTheClock ? "You're On The Clock!" : 'On The Clock'}
                                </p>
                                <p className="text-sm text-slate-300 font-medium">
                                    {otcUser ? displayTeamName(otcUser) : `Slot ${onTheClock.draftSlot}`}
                                    <span className="text-slate-500 ml-2">
                                        Rd {onTheClock.round}, Pick {onTheClock.pickInRound}
                                    </span>
                                </p>
                            </div>
                        </div>
                        {timeRemaining != null && (
                            <div className={`font-mono text-2xl font-bold tabular-nums ${
                                timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 
                                timeRemaining <= 30 ? 'text-amber-400' : 'text-slate-300'
                            }`}>
                                {formatTime(timeRemaining)}
                            </div>
                        )}
                    </div>
                    {/* Timer bar */}
                    {timeRemaining != null && draft?.settings?.pick_timer && (
                        <div className="mt-2 h-1 rounded-full bg-slate-700/50 overflow-hidden">
                            <motion.div 
                                className={`h-full rounded-full ${
                                    timeRemaining <= 10 ? 'bg-red-500' : 
                                    timeRemaining <= 30 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                initial={{ width: '100%' }}
                                animate={{ width: `${Math.max(0, (timeRemaining / draft.settings.pick_timer) * 100)}%` }}
                                transition={{ duration: 1, ease: 'linear' }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Pick Feed */}
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Recent Picks</span>
                <span className="text-slate-600">{picks.length} total</span>
            </div>

            <div ref={feedRef} className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1" style={{ maxHeight: '400px' }}>
                <AnimatePresence initial={false}>
                    {recentPicks.map((pick, idx) => {
                        const pickUser = getUserForRoster(pick.roster_id);
                        const pos = pick.metadata?.position || '??';
                        const posColor = getPositionColor(pos);
                        const isUserPick = String(pick.roster_id) === String(userRosterId);

                        return (
                            <motion.div
                                key={pick.pick_no}
                                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.3, delay: idx === 0 ? 0.1 : 0 }}
                                className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${
                                    isUserPick 
                                        ? 'bg-primary/10 border-primary/30' 
                                        : 'bg-slate-800/60 border-slate-700/40 hover:border-slate-600/60'
                                }`}
                            >
                                {/* Pick Number */}
                                <div className="text-[10px] font-mono text-slate-500 w-6 text-center shrink-0">
                                    {pick.pick_no}
                                </div>

                                {/* Player Headshot */}
                                <div className="relative shrink-0">
                                    <img
                                        src={playerHeadshotUrl(pick.player_id)}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover bg-slate-700"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${posColor.dot} flex items-center justify-center`}>
                                        <span className="text-[6px] font-black text-white">{pos.charAt(0)}</span>
                                    </div>
                                </div>

                                {/* Player Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-200 truncate">
                                        {pick.metadata?.first_name} {pick.metadata?.last_name}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate">
                                        {pick.metadata?.team || 'FA'} • {pickUser ? displayTeamName(pickUser) : `Roster ${pick.roster_id}`}
                                    </p>
                                </div>

                                {/* Position Badge */}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor.bg} ${posColor.text} ${posColor.border} border shrink-0`}>
                                    {pos}
                                </span>

                                {/* User indicator */}
                                {isUserPick && (
                                    <User className="w-3 h-3 text-primary shrink-0" />
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {picks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <Clock className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">No picks yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DraftPickFeed;
