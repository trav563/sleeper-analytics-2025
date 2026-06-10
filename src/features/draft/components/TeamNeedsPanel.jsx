import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, Shield } from 'lucide-react';
import { analyzeRosterNeeds, getLeagueFormatLabels, getPositionColor } from '../../../utils/draftEngine';

/**
 * TeamNeedsPanel — Visual dashboard of the user's roster construction.
 * Shows positional needs bars that update in real-time as the user drafts.
 */
const TeamNeedsPanel = ({ league, userPicks = [], players = {}, existingRoster = [] }) => {
    const analysis = useMemo(() => {
        if (!league?.roster_positions) return null;
        return analyzeRosterNeeds(league.roster_positions, userPicks, players, existingRoster);
    }, [league, userPicks, players, existingRoster]);

    const formatLabels = useMemo(() => {
        if (!league) return [];
        return getLeagueFormatLabels(league.scoring_settings || {}, league.roster_positions || []);
    }, [league]);

    if (!analysis) return null;

    const { filledSlots, totalStarters, startersFilled } = analysis;
    const completionPct = totalStarters > 0 ? Math.round((startersFilled / totalStarters) * 100) : 0;

    // Filter to only show starter slots
    const displaySlots = Object.entries(filledSlots).filter(([slot]) => 
        !['BN', 'IR', 'TAXI'].includes(slot)
    );

    return (
        <div className="flex flex-col h-full">
            {/* League Format Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                {formatLabels.map((label, i) => (
                    <span key={i} className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/30">
                        {label}
                    </span>
                ))}
            </div>

            {/* Completion Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-slate-200">Your Roster</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${
                        completionPct === 100 ? 'text-emerald-400' : 
                        completionPct >= 50 ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                        {startersFilled}/{totalStarters} starters
                    </span>
                </div>
            </div>

            {/* Progress Ring */}
            <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-700" />
                        <circle 
                            cx="28" cy="28" r="24" fill="none" 
                            strokeWidth="4" 
                            strokeLinecap="round"
                            className={completionPct === 100 ? 'text-emerald-500' : completionPct >= 50 ? 'text-blue-500' : 'text-amber-500'}
                            strokeDasharray={`${completionPct * 1.508} 150.8`}
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                        {completionPct}%
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400">
                        {completionPct === 100 
                            ? 'All starter slots filled! Focus on bench depth.'
                            : Object.keys(analysis.needs).length > 0
                                ? `Still need: ${Object.entries(analysis.needs).map(([pos, count]) => `${count}× ${pos}`).join(', ')}`
                                : 'Looking good so far!'}
                    </p>
                </div>
            </div>

            {/* Position Bars */}
            <div className="space-y-2 flex-1">
                {displaySlots.map(([slot, { required, filled }]) => {
                    const remaining = required - filled;
                    const pct = required > 0 ? Math.round((filled / required) * 100) : 100;
                    const posColor = getPositionColor(slot);
                    
                    let statusIcon = null;
                    let statusColor = 'text-slate-500';
                    if (pct === 100) {
                        statusIcon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
                        statusColor = 'text-emerald-400';
                    } else if (pct > 0) {
                        statusIcon = <Info className="w-3 h-3 text-amber-400" />;
                        statusColor = 'text-amber-400';
                    } else {
                        statusIcon = <AlertTriangle className="w-3 h-3 text-red-400" />;
                        statusColor = 'text-red-400';
                    }

                    return (
                        <div key={slot} className="group">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${posColor.dot}`} />
                                    <span className="text-xs font-semibold text-slate-300">{slot}</span>
                                    {statusIcon}
                                </div>
                                <span className={`text-[10px] font-mono ${statusColor}`}>
                                    {filled}/{required}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                                        pct === 100 ? 'bg-emerald-500' : 
                                        pct > 0 ? 'bg-amber-500' : 'bg-slate-600'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* User's Drafted Players */}
            {userPicks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700/40">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Your Picks</p>
                    <div className="flex flex-wrap gap-1.5">
                        {userPicks.map(pick => {
                            const pos = pick.metadata?.position || '??';
                            const posColor = getPositionColor(pos);
                            return (
                                <div key={pick.pick_no} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] ${posColor.bg} ${posColor.border}`}>
                                    <span className={`font-bold ${posColor.text}`}>{pos}</span>
                                    <span className="text-slate-300 font-medium truncate max-w-[80px]">
                                        {pick.metadata?.last_name || pick.player_id}
                                    </span>
                                    <span className="text-slate-500">#{pick.pick_no}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamNeedsPanel;
