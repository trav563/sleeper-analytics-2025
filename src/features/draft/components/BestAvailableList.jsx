import { useState } from 'react';
import { Star, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Badge } from '../../../components/ui/Badge';
import { useTierBreaks } from '../hooks/useTierBreaks';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const POSITION_COLOR = {
    QB: 'bg-bad/15 text-bad border-bad/30',
    RB: 'bg-good/15 text-good border-good/30',
    WR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    TE: 'bg-signal/15 text-signal/80 border-signal/30',
    K: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    DEF: 'bg-slate-500/15 text-text-dim border-slate-500/30',
};

const TIER_COLORS = [
    'border-t-signal',
    'border-t-sky-400',
    'border-t-good',
    'border-t-violet-400',
    'border-t-bad',
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
        <div className="rounded-xl border border-line bg-bg-1">
            <div className="p-4 border-b border-line">
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
                        <Search className="absolute left-2 top-2 w-4 h-4 text-text-mute" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search…"
                            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md bg-bg-3 border border-line focus:outline-none focus:ring-1 focus:ring-primary"
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
                                    : 'bg-bg-2 text-text-mute hover:bg-bg-3'
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
                {filtered.length === 0 && (
                    <p className="p-6 text-center text-sm text-text-mute">
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
                        <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-text-mute bg-bg-2">
                            Tier {tier.tier}
                        </div>
                        {tier.players.map((p) => {
                            const queued = isQueued(p.id);
                            return (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-3 px-4 py-2 border-b border-line/50 hover:bg-bg-2 transition-colors"
                                >
                                    <button
                                        onClick={() => onToggleQueue(p.id)}
                                        className={cn(
                                            'p-1 rounded transition-colors',
                                            queued ? 'text-signal' : 'text-text-mute hover:text-signal/80'
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
                                        <p className="text-xs text-text-mute">
                                            {p.team}
                                            {p.age != null ? ` · age ${p.age}` : ''}
                                            {p.yearsExp === 0 ? ' · rookie' : p.yearsExp != null ? ` · ${p.yearsExp}y` : ''}
                                            {p.injury ? (
                                                <span className="text-bad ml-1">· {p.injury}</span>
                                            ) : null}
                                        </p>
                                    </div>
                                    <div className="text-right text-sm tnum min-w-[64px]">
                                        {p.value > 0 ? (
                                            <>
                                                <span className="font-semibold text-text">{p.value}</span>
                                                <p className="text-2xs text-text-mute">FC value</p>
                                            </>
                                        ) : p.searchRank < 9999 ? (
                                            <>
                                                <span className="font-semibold text-text-dim">#{p.searchRank}</span>
                                                <p className="text-2xs text-text-mute">Sleeper rank</p>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-text-mute">—</span>
                                                <p className="text-2xs text-text-mute">no rank</p>
                                            </>
                                        )}
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
