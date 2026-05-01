import { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { getDraftablePositions } from '../utils/draftTypeDetect';

const TIERS_BY_TYPE = {
    rookie: [
        { label: 'Elite', cap: 3 },
        { label: 'Good', cap: 8 },
        { label: 'Depth', cap: 15 },
    ],
    default: [
        { label: 'Elite', cap: 12 },
        { label: 'Good', cap: 24 },
        { label: 'Depth', cap: 48 },
    ],
};

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
 *
 * Tiers and positions adapt to draft type — rookie drafts use tighter
 * tiers (3/8/15) and skip K/DEF entirely.
 */
export default function PositionScarcityHeatmap({ availablePlayers, fullRanked, draftType }) {
    const tiers = TIERS_BY_TYPE[draftType === 'rookie' ? 'rookie' : 'default'];
    // Always exclude K/DEF from the scarcity grid — even in redraft, those
    // positions are streamed weekly and a "scarcity" signal isn't meaningful.
    const positions = getDraftablePositions(draftType).filter(
        (p) => p !== 'K' && p !== 'DEF'
    );

    const data = useMemo(() => {
        const availableIds = new Set(availablePlayers.map((p) => p.id));
        const out = {};
        for (const pos of positions) {
            out[pos] = {};
            const ranked = (fullRanked || []).filter((p) => p.pos === pos);
            for (const tier of tiers) {
                const slice = ranked.slice(0, tier.cap);
                const remaining = slice.filter((p) => availableIds.has(p.id)).length;
                out[pos][tier.label] = { remaining, total: slice.length };
            }
        }
        return out;
    }, [availablePlayers, fullRanked, positions, tiers]);

    return (
        <div className="rounded-xl border border-line bg-bg-1 p-4">
            <h3 className="text-base font-semibold mb-3 text-text">Position Scarcity</h3>
            <div className="grid grid-cols-[60px_repeat(3,1fr)] gap-1 text-xs">
                <div />
                {tiers.map((t) => (
                    <div key={t.label} className="text-center text-2xs text-text-mute uppercase tracking-wider pb-1">
                        Top {t.cap}
                    </div>
                ))}
                {positions.map((pos) => (
                    <div key={pos} className="contents">
                        <div className="font-mono font-semibold text-text-mute self-center">{pos}</div>
                        {tiers.map((t) => {
                            const cell = data[pos]?.[t.label] || { remaining: 0, total: 0 };
                            return (
                                <div
                                    key={t.label}
                                    className={cn(
                                        'rounded-md py-2 text-center font-mono font-bold tnum',
                                        colorFor(cell.remaining, cell.total)
                                    )}
                                    title={`${cell.remaining} / ${cell.total} top-${t.cap} ${pos} remaining`}
                                >
                                    {cell.remaining}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            <p className="text-2xs text-text-mute mt-3">
                Red cells signal a positional run underway or already played out.
            </p>
        </div>
    );
}
