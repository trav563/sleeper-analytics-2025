import { useMemo } from 'react';
import { cn } from '../../../lib/utils';

const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const TIERS = [
    { label: 'Elite', cap: 12 },
    { label: 'Good', cap: 24 },
    { label: 'Replace', cap: 48 },
];

function colorFor(remaining, total) {
    if (total === 0) return 'bg-slate-800/40 text-muted-foreground';
    const pct = remaining / total;
    if (pct >= 0.5) return 'bg-emerald-500/30 text-emerald-100 border border-emerald-500/40';
    if (pct >= 0.25) return 'bg-amber-500/30 text-amber-100 border border-amber-500/40';
    return 'bg-rose-500/30 text-rose-100 border border-rose-500/40';
}

/**
 * Counts remaining top-N at each position from the FantasyCalc-sorted available
 * pool. The "scarcity" signal is visceral: red cells = run pressure.
 */
export default function PositionScarcityHeatmap({ availablePlayers, fullRanked }) {
    const data = useMemo(() => {
        // `fullRanked` is the FULL pool (drafted + undrafted) sorted by value
        // so we know the original top-N membership; `availablePlayers` is what
        // remains. We compute remaining = topN(full) ∩ availableIds.
        const availableIds = new Set(availablePlayers.map((p) => p.id));
        const out = {};
        for (const pos of POSITIONS) {
            out[pos] = {};
            const ranked = (fullRanked || []).filter((p) => p.pos === pos);
            for (const tier of TIERS) {
                const slice = ranked.slice(0, tier.cap);
                const remaining = slice.filter((p) => availableIds.has(p.id)).length;
                out[pos][tier.label] = { remaining, total: slice.length };
            }
        }
        return out;
    }, [availablePlayers, fullRanked]);

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <h3 className="text-base font-semibold mb-3">Position Scarcity</h3>
            <div className="grid grid-cols-[60px_repeat(3,1fr)] gap-1 text-xs">
                <div />
                {TIERS.map((t) => (
                    <div key={t.label} className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-1">
                        Top {t.cap}
                    </div>
                ))}
                {POSITIONS.map((pos) => (
                    <div key={pos} className="contents">
                        <div className="font-mono font-semibold text-muted-foreground self-center">{pos}</div>
                        {TIERS.map((t) => {
                            const { remaining, total } = data[pos][t.label];
                            return (
                                <div
                                    key={t.label}
                                    className={cn(
                                        'rounded-md py-2 text-center font-mono font-bold tabular-nums',
                                        colorFor(remaining, total)
                                    )}
                                    title={`${remaining} / ${total} top-${t.cap} ${pos} remaining`}
                                >
                                    {remaining}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
                Red cells signal a positional run is underway or already played out.
            </p>
        </div>
    );
}
