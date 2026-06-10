import { useMemo } from 'react';
import { Grid3x3, ChevronRight } from 'lucide-react';
import { getPositionColor } from '../../../utils/draftEngine';
import { displayTeamName } from '../../../utils/nflData';

/**
 * DraftBoardMini — Compact visual draft board grid.
 * Columns = teams (draft slots), rows = rounds.
 * Snake order visualization with position-colored cells.
 */
const DraftBoardMini = ({ draft, picks = [], users = [], onTheClock, userRosterId, rosterIdToUserId }) => {
    const board = useMemo(() => {
        if (!draft) return { grid: [], slots: [], rounds: 0 };

        const totalTeams = draft.settings?.teams || 12;
        const totalRounds = draft.settings?.rounds || 15;
        const draftType = draft.type || 'snake';
        const slotToRosterId = draft.slot_to_roster_id || {};

        // Build slot order (1 to totalTeams)
        const slots = Array.from({ length: totalTeams }, (_, i) => i + 1);

        // Build grid: rounds x slots
        const grid = [];
        for (let round = 1; round <= Math.min(totalRounds, 8); round++) { // Cap at 8 rounds for mini view
            const row = [];
            for (let slotIdx = 0; slotIdx < totalTeams; slotIdx++) {
                let draftSlot;
                if (draftType === 'snake' && round % 2 === 0) {
                    draftSlot = totalTeams - slotIdx;
                } else {
                    draftSlot = slotIdx + 1;
                }

                const pickNo = (round - 1) * totalTeams + slotIdx + 1;
                const pick = picks.find(p => p.pick_no === pickNo);
                const rosterId = slotToRosterId[String(draftSlot)];

                row.push({
                    round,
                    draftSlot,
                    pickNo,
                    pick,
                    rosterId,
                    isUser: String(rosterId) === String(userRosterId),
                    isCurrent: onTheClock?.overallPick === pickNo,
                });
            }
            grid.push(row);
        }

        return { grid, slots, rounds: Math.min(totalRounds, 8), totalRounds };
    }, [draft, picks, onTheClock, userRosterId]);

    if (!draft || board.grid.length === 0) return null;

    const getUserForRoster = (rosterId) => {
        const uid = rosterIdToUserId?.[String(rosterId)];
        return users.find(u => u.user_id === uid);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Grid3x3 className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-slate-200">Draft Board</span>
                </div>
                {board.totalRounds > 8 && (
                    <span className="text-[10px] text-slate-500">Showing first 8 of {board.totalRounds} rounds</span>
                )}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[600px]">
                    {/* Header: Team names */}
                    <thead>
                        <tr>
                            <th className="p-1 text-[8px] text-slate-600 font-mono w-8">Rd</th>
                            {board.slots.map(slot => {
                                const rosterId = draft.slot_to_roster_id?.[String(slot)];
                                const user = getUserForRoster(rosterId);
                                const isUserCol = String(rosterId) === String(userRosterId);
                                return (
                                    <th key={slot} className={`p-1 text-[8px] font-semibold truncate max-w-[60px] ${isUserCol ? 'text-primary' : 'text-slate-500'}`}>
                                        {user ? displayTeamName(user).substring(0, 6) : `#${slot}`}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {board.grid.map((row, roundIdx) => (
                            <tr key={roundIdx}>
                                <td className="p-1 text-[9px] font-mono text-slate-600 text-center font-bold">
                                    {roundIdx + 1}
                                </td>
                                {row.map((cell, cellIdx) => {
                                    const pos = cell.pick?.metadata?.position;
                                    const posColor = pos ? getPositionColor(pos) : null;

                                    return (
                                        <td key={cellIdx} className="p-0.5">
                                            <div className={`
                                                h-7 rounded flex items-center justify-center text-[8px] font-bold
                                                transition-all duration-300 relative
                                                ${cell.isCurrent 
                                                    ? 'bg-amber-500/30 border border-amber-500/60 ring-1 ring-amber-500/30 animate-pulse' 
                                                    : cell.pick 
                                                        ? `${posColor?.bg || 'bg-slate-700/40'} border border-slate-700/30` 
                                                        : cell.isUser
                                                            ? 'bg-primary/5 border border-primary/20'
                                                            : 'bg-slate-800/20 border border-slate-800/20'
                                                }
                                            `}>
                                                {cell.pick ? (
                                                    <span className={`truncate px-0.5 ${posColor?.text || 'text-slate-400'}`}>
                                                        {cell.pick.metadata?.last_name?.substring(0, 5) || pos || '•'}
                                                    </span>
                                                ) : cell.isCurrent ? (
                                                    <ChevronRight className="w-3 h-3 text-amber-400" />
                                                ) : null}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Position Legend */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(pos => {
                    const posColor = getPositionColor(pos);
                    return (
                        <span key={pos} className={`flex items-center gap-1 text-[8px] font-bold ${posColor.text}`}>
                            <span className={`w-2 h-2 rounded-sm ${posColor.dot}`} />
                            {pos}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

export default DraftBoardMini;
