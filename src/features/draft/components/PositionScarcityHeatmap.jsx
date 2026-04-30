import { useMemo } from 'react';
import { cn } from '../../../lib/utils';

const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const TIERS = [
    { label: 'Elite', cap: 12 },
    { label: 'Good', cap: 24 },
    { label: 'Replace', cap: 48 },
];

function colorFor(remaining, total) {
    if (total === 0) return 'bg-bg-2 text-text-mute';
    const pct = remaining / total;
    if (pct >= 0.5) return 'bg-good/30 text-good border border-good/40';
    if (pct >= 0.25) return 'bg-signal/30 text-signal/90 border border-signal/40';
    return 'bg-bad/30 text-bad border border-bad/40';
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
        <div className="rounded-xl border border-line bg-bg-1 p-4">
            <h3 className="text-base font-semibold mb-3">Position Scarcity</h3>
            <div className="grid grid-cols-[60px_repeat(3,1fr)] gap-1 text-xs">
                <div />
                {TIERS.map((t) => (
                    <div key={t.label} className="text-center text-[10px] text-text-mute uppercase tracking-wider pb-1">
                        Top {t.cap}
                    </div>
                ))}
                {POSITIONS.map((pos) => (
                    <div key={pos} className="contents">
                        <div className="font-mono font-semibold text-text-mute self-center">{pos}</div>
                        {TIERS.map((t) => {
                            const { remaining, total } = data[pos][t.label];
                            return (
                                <div
                                    key={t.label}
                                    className={cn(
                                        'rounded-md py-2 text-center font-mono font-bold tnum',
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
            <p className="text-[10px] text-text-mute mt-3">
                Red cells signal a positional run is underway or already played out.
            </p>
        </div>
    );
}
