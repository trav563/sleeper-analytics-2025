import { useQuery } from '@tanstack/react-query';
import { Star, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/utils';

const POSITION_COLOR = {
    QB: 'bg-bad/15 text-bad border-bad/30',
    RB: 'bg-good/15 text-good border-good/30',
    WR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    TE: 'bg-signal/15 text-signal/80 border-signal/30',
    K: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    DEF: 'bg-bg-3 text-text-dim border-line',
};

function NewsForPlayer({ playerName }) {
    const { data: newsItems, isLoading } = useQuery({
        queryKey: ['nflNews'],
        queryFn: async () => {
            const res = await fetch('/api/news');
            if (!res.ok) {
                if (res.status === 404) return [];
                throw new Error('Failed to fetch news');
            }
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) return [];
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
        retry: false,
    });

    if (isLoading) {
        return <p className="text-sm text-text-mute">Loading news…</p>;
    }

    const stripped = playerName.replace(/\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '');
    const matches = (newsItems || [])
        .filter((item) => item.title?.toLowerCase().includes(stripped.toLowerCase()))
        .slice(0, 5);

    if (matches.length === 0) {
        return <p className="text-sm text-text-mute">No recent news for this player.</p>;
    }

    return (
        <ul className="space-y-2">
            {matches.map((item, i) => {
                const days = item.pubDate
                    ? Math.floor((Date.now() - new Date(item.pubDate).getTime()) / 86400000)
                    : null;
                return (
                    <li key={i} className="text-sm">
                        {item.link ? (
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-text hover:text-signal flex items-start gap-1.5 group"
                            >
                                <span className="flex-1">{item.title}</span>
                                <ExternalLink className="w-3 h-3 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                        ) : (
                            <span className="text-text">{item.title}</span>
                        )}
                        {days != null && (
                            <span className="text-2xs text-text-mute ml-1">
                                {days === 0 ? '· today' : `· ${days}d ago`}
                            </span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * Modal popover for a player. Shown when the user clicks any player name
 * in the draft UI. Reuses the existing /api/news endpoint via React Query
 * (cached 10m) so opening multiple dialogs doesn't refetch.
 */
export default function PlayerDetailDialog({
    selected,
    players,
    onClose,
    onToggleQueue,
    isQueued,
}) {
    if (!selected) return null;

    const fullPlayer = players?.[selected.id];
    const name = fullPlayer
        ? `${fullPlayer.first_name || ''} ${fullPlayer.last_name || ''}`.trim()
        : selected.name;
    const pos = fullPlayer?.position || selected.pos;
    const team = fullPlayer?.team || selected.team || 'FA';
    const age = fullPlayer?.age ?? selected.age;
    const yearsExp = fullPlayer?.years_exp ?? selected.yearsExp;
    const injury = fullPlayer?.injury_status || selected.injury;
    const queued = isQueued?.(selected.id) || false;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg bg-bg-1 border border-line p-0">
                <header className="flex items-start justify-between gap-3 p-5 border-b border-line">
                    <div className="flex items-center gap-3">
                        <Badge
                            variant="outline"
                            className={cn('font-mono w-12 justify-center', POSITION_COLOR[pos])}
                        >
                            {pos}
                        </Badge>
                        <div>
                            <h2 className="text-xl font-bold text-text">{name}</h2>
                            <p className="text-xs text-text-mute font-mono mt-0.5">
                                {team}
                                {age != null && ` · age ${age}`}
                                {yearsExp != null && (
                                    yearsExp === 0 ? ' · rookie' : ` · ${yearsExp}y exp`
                                )}
                                {injury && <span className="text-bad ml-1">· {injury}</span>}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-mute hover:text-text transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="p-5 space-y-4">
                    {/* Value strip */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-bg-2 border border-line px-3 py-2">
                            <div className="text-2xs text-text-mute uppercase tracking-wider">FC value</div>
                            <div className="tnum font-bold text-lg text-text mt-0.5">
                                {selected.value > 0 ? selected.value : '—'}
                            </div>
                        </div>
                        <div className="rounded-md bg-bg-2 border border-line px-3 py-2">
                            <div className="text-2xs text-text-mute uppercase tracking-wider">Sleeper rank</div>
                            <div className="tnum font-bold text-lg text-text mt-0.5">
                                {selected.searchRank != null && selected.searchRank < 9999
                                    ? `#${selected.searchRank}`
                                    : '—'}
                            </div>
                        </div>
                    </div>

                    {/* News */}
                    <div>
                        <h3 className="text-2xs uppercase tracking-wider text-text-mute font-bold mb-2">
                            Recent News
                        </h3>
                        <NewsForPlayer playerName={name} />
                    </div>
                </div>

                <footer className="flex items-center justify-end gap-2 p-4 border-t border-line bg-bg-2/50">
                    {onToggleQueue && (
                        <Button
                            variant={queued ? 'secondary' : 'default'}
                            size="sm"
                            onClick={() => onToggleQueue(selected.id)}
                        >
                            <Star className="w-4 h-4 mr-1.5" fill={queued ? 'currentColor' : 'none'} />
                            {queued ? 'Unstar' : 'Star'}
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
