import { Star, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

/**
 * Compact list of starred players. Shows queued players that haven't been
 * drafted yet. Click ★ to remove.
 */
export default function QueueManager({ queue, players, picks, onToggle, onClear }) {
    const draftedIds = new Set((picks || []).map((p) => p.player_id).filter(Boolean));
    const items = [...queue]
        .filter((id) => !draftedIds.has(id))
        .map((id) => {
            const p = players?.[id];
            return {
                id,
                name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : id,
                pos: p?.position || '?',
                team: p?.team || 'FA',
            };
        });

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                    My Queue
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </h3>
                {items.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClear}
                        className="text-muted-foreground hover:text-rose-400 h-7 px-2"
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear
                    </Button>
                )}
            </div>
            <div className="p-4 space-y-1.5 max-h-[400px] overflow-y-auto">
                {items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Star players in the Best Available list to queue them.
                    </p>
                )}
                {items.map((p) => (
                    <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors"
                    >
                        <button
                            onClick={() => onToggle(p.id)}
                            className="text-amber-400 hover:text-amber-200"
                            aria-label="Unstar"
                        >
                            <Star className="w-4 h-4" fill="currentColor" />
                        </button>
                        <Badge variant="outline" className="font-mono text-[10px] w-10 justify-center">
                            {p.pos}
                        </Badge>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">{p.team}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
