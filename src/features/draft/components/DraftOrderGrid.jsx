import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/utils';

/**
 * Visualizes the snake draft order. Each row = round, each column = slot.
 * Cells highlight the user's own picks; a small dot marks completed picks.
 */
export default function DraftOrderGrid({ draft, picks, rosters, users, userId, currentPickNo }) {
    if (!draft) return null;

    const numTeams = draft.settings?.teams || draft.settings?.num_teams || 12;
    const totalRounds = draft.settings?.rounds || 0;
    const slotToRoster = draft.slot_to_roster_id || {};
    const draftOrder = draft.draft_order || {};
    const userSlot = userId ? draftOrder[userId] : null;
    const isSnake = draft.type !== 'linear';

    const pickByNo = {};
    (picks || []).forEach((p) => { pickByNo[p.pick_no] = p; });

    const slotsHeader = Array.from({ length: numTeams }, (_, i) => i + 1);

    return (
        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="p-4 border-b border-line flex items-center justify-between">
                <h3 className="text-base font-semibold">Draft Order</h3>
                <Badge variant="outline" className="text-[10px]">
                    {numTeams} teams · {totalRounds} {totalRounds === 1 ? 'round' : 'rounds'}
                </Badge>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-bg-2">
                            <th className="px-2 py-1.5 text-left text-text-mute font-medium">Rd</th>
                            {slotsHeader.map((slot) => {
                                const rosterId = slotToRoster[slot];
                                const roster = rosters?.find((r) => r.roster_id === rosterId);
                                const owner = roster ? users?.find((u) => u.user_id === roster.owner_id) : null;
                                const isMe = slot === userSlot;
                                return (
                                    <th
                                        key={slot}
                                        className={cn(
                                            'px-2 py-1.5 text-left font-medium',
                                            isMe ? 'bg-signal/20 text-signal/90' : 'text-text-mute'
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-[80px]">
                                            {owner?.avatar && (
                                                <img
                                                    src={avatarUrl(owner.avatar)}
                                                    alt=""
                                                    className="w-5 h-5 rounded-full"
                                                />
                                            )}
                                            <span className="truncate max-w-[100px]">
                                                {owner ? displayTeamName(owner) : `Slot ${slot}`}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: totalRounds }, (_, rIdx) => {
                            const round = rIdx + 1;
                            return (
                                <tr key={round} className="border-t border-line/60">
                                    <td className="px-2 py-1.5 font-mono text-text-mute">{round}</td>
                                    {slotsHeader.map((slot) => {
                                        const slotInRound = isSnake && round % 2 === 0
                                            ? numTeams - slot + 1
                                            : slot;
                                        const pickNo = (round - 1) * numTeams + slotInRound;
                                        const pick = pickByNo[pickNo];
                                        const isCurrent = pickNo === currentPickNo;
                                        const isMe = slot === userSlot;
                                        return (
                                            <td
                                                key={slot}
                                                className={cn(
                                                    'px-2 py-1.5 align-top',
                                                    isCurrent && 'bg-signal/30 ring-1 ring-signal',
                                                    !isCurrent && isMe && 'bg-signal/5'
                                                )}
                                            >
                                                <div className="text-[10px] text-text-mute">#{pickNo}</div>
                                                {pick ? (
                                                    <div className="font-medium truncate max-w-[100px]">
                                                        {pick.metadata?.first_name?.[0]}. {pick.metadata?.last_name}
                                                    </div>
                                                ) : (
                                                    <div className="text-text-mute/40">—</div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
