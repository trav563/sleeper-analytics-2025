import { Badge } from '../../../components/ui/Badge';
import { displayTeamName } from '../../../utils/nflData';

/**
 * Reverse-chronological feed of the most recent N picks.
 */
export default function RecentPicksFeed({ picks, players, rosters, users, limit = 10, userSlot }) {
    const recent = (picks || []).slice(-limit).reverse();

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40">
            <div className="p-4 border-b border-slate-800">
                <h3 className="text-base font-semibold">Recent Picks</h3>
            </div>
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                {recent.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        No picks yet.
                    </p>
                )}
                {recent.map((pick) => {
                    const p = players?.[pick.player_id];
                    const name = p
                        ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
                        : `${pick.metadata?.first_name || ''} ${pick.metadata?.last_name || ''}`.trim() || '—';
                    const pos = p?.position || pick.metadata?.position || '?';
                    const team = p?.team || pick.metadata?.team || 'FA';
                    const roster = rosters?.find((r) => r.roster_id === pick.roster_id);
                    const owner = roster ? users?.find((u) => u.user_id === roster.owner_id) : null;
                    const ownerName = owner ? displayTeamName(owner) : `Team ${pick.roster_id}`;
                    const isMine = pick.draft_slot === userSlot;

                    return (
                        <div
                            key={pick.pick_no}
                            className={`flex items-center gap-3 p-2 rounded-lg ${
                                isMine ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/40'
                            }`}
                        >
                            <div className="w-10 text-center">
                                <p className="text-[10px] text-muted-foreground">#</p>
                                <p className="font-mono font-bold text-sm">{pick.pick_no}</p>
                            </div>
                            <Badge variant="outline" className="font-mono w-12 justify-center text-[10px]">
                                {pos}
                            </Badge>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-sm">{name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {team} → {ownerName}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
