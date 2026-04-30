import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/utils';

const POSITION_COLOR = {
    QB: 'border-bad/40 bg-bad/10',
    RB: 'border-good/40 bg-good/10',
    WR: 'border-sky-500/40 bg-sky-500/10',
    TE: 'border-signal/40 bg-signal/10',
    K: 'border-violet-500/40 bg-violet-500/10',
    DEF: 'border-slate-500/40 bg-slate-500/10',
};

/**
 * Shows the picks the logged-in user has made in this draft, in pick order.
 * For rookie drafts: usually 3 cards. For startups: many.
 */
export default function MyDraftRoster({ picks, players, userSlot, draftType }) {
    const myPicks = (picks || [])
        .filter((p) => p.draft_slot === userSlot)
        .sort((a, b) => a.pick_no - b.pick_no);

    return (
        <div className="rounded-xl border border-line bg-bg-1">
            <div className="p-4 border-b border-line flex items-center justify-between">
                <h3 className="text-base font-semibold">My Picks</h3>
                <Badge variant="secondary" className="text-[10px]">
                    {myPicks.length} {myPicks.length === 1 ? 'pick' : 'picks'}
                </Badge>
            </div>
            <div className="p-4 space-y-2">
                {myPicks.length === 0 && (
                    <p className="text-sm text-text-mute text-center py-6">
                        No picks yet. {draftType === 'rookie' ? 'Your rookies will appear here.' : 'Your roster will fill here.'}
                    </p>
                )}
                {myPicks.map((pick) => {
                    const p = players?.[pick.player_id];
                    const name = p
                        ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
                        : `${pick.metadata?.first_name || ''} ${pick.metadata?.last_name || ''}`.trim() || '—';
                    const pos = p?.position || pick.metadata?.position || '?';
                    const team = p?.team || pick.metadata?.team || 'FA';
                    return (
                        <div
                            key={pick.pick_no}
                            className={cn(
                                'flex items-center gap-3 p-2 rounded-lg border',
                                POSITION_COLOR[pos] || 'border-line bg-bg-2'
                            )}
                        >
                            <div className="w-10 text-center">
                                <p className="text-[10px] text-text-mute">Pick</p>
                                <p className="font-mono font-bold text-sm">{pick.pick_no}</p>
                            </div>
                            <Badge variant="outline" className="font-mono w-12 justify-center">
                                {pos}
                            </Badge>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{name}</p>
                                <p className="text-xs text-text-mute">
                                    {team} · R{pick.round}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
