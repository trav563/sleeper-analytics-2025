import { useState } from 'react';
import { Star, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Badge } from '../../../components/ui/Badge';
import { useTierBreaks } from '../hooks/useTierBreaks';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const POSITION_COLOR = {
    QB: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    RB: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    WR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    TE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    K: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    DEF: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const TIER_COLORS = [
    'border-t-amber-400',
    'border-t-sky-400',
    'border-t-emerald-400',
    'border-t-violet-400',
    'border-t-rose-400',
    'border-t-cyan-400',
    'border-t-pink-400',
    'border-t-lime-400',
];

export default function BestAvailableList({
    availablePlayers,
    positionFilter,
    onPositionFilter,
    isQueued,
    onToggleQueue,
    showRookieOnlyHint = false,
}) {
    const [search, setSearch] = useState('');

    const filtered = search
        ? availablePlayers.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
        : availablePlayers;

    const tiers = useTierBreaks(filtered);

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40">
            <div className="p-4 border-b border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                        Best Available
                        {showRookieOnlyHint && (
                            <Badge variant="outline" className="text-[10px]">
                                Rookies only
                            </Badge>
                        )}
                    </h3>
                    <div className="relative w-44">
                        <Search className="absolute left-2 top-2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search…"
                            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md bg-slate-800/60 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap gap-1">
                    {POSITIONS.map((p) => (
                        <button
                            key={p}
                            onClick={() => onPositionFilter(p)}
                            className={cn(
                                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                                positionFilter === p
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-slate-800 text-muted-foreground hover:bg-slate-700'
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
                {filtered.length === 0 && (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                        No players match the current filter.
                    </p>
                )}
                {tiers.map((tier, tierIdx) => (
                    <div
                        key={tier.tier}
                        className={cn(
                            'border-t-2',
                            TIER_COLORS[(tierIdx) % TIER_COLORS.length]
                        )}
                    >
                        <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-slate-900/60">
                            Tier {tier.tier}
                        </div>
                        {tier.players.map((p) => {
                            const queued = isQueued(p.id);
                            return (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-3 px-4 py-2 border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors"
                                >
                                    <button
                                        onClick={() => onToggleQueue(p.id)}
                                        className={cn(
                                            'p-1 rounded transition-colors',
                                            queued ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'
                                        )}
                                        aria-label={queued ? 'Unstar' : 'Star'}
                                    >
                                        <Star className="w-4 h-4" fill={queued ? 'currentColor' : 'none'} />
                                    </button>
                                    <Badge
                                        variant="outline"
                                        className={cn('font-mono w-12 justify-center', POSITION_COLOR[p.pos])}
                                    >
                                        {p.pos}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{p.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {p.team}
                                            {p.age != null ? ` · age ${p.age}` : ''}
                                            {p.yearsExp === 0 ? ' · rookie' : p.yearsExp != null ? ` · ${p.yearsExp}y` : ''}
                                            {p.injury ? (
                                                <span className="text-rose-400 ml-1">· {p.injury}</span>
                                            ) : null}
                                        </p>
                                    </div>
                                    <div className="text-right text-sm tabular-nums">
                                        <span className="font-semibold">{p.value || '—'}</span>
                                        <p className="text-[10px] text-muted-foreground">value</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
