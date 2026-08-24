import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { activeRosterIds } from '../../../utils/leagueMath';

const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const POS_TONE = {
    QB: { text: 'text-bad', bg: 'bg-bad' },
    RB: { text: 'text-good', bg: 'bg-good' },
    WR: { text: 'text-signal', bg: 'bg-signal' },
    TE: { text: 'text-signal-2', bg: 'bg-signal-2' },
};

/** Age bands used for the per-position curve. */
const BANDS = [
    { key: 'u24', label: '≤23', test: (a) => a <= 23 },
    { key: '24_27', label: '24-27', test: (a) => a >= 24 && a <= 27 },
    { key: '28_30', label: '28-30', test: (a) => a >= 28 && a <= 30 },
    { key: 'o30', label: '31+', test: (a) => a >= 31 },
];

/**
 * How the roster is built: age distribution per position and how much of the
 * team's market value sits in the starting lineup vs the bench.
 */
const RosterConstruction = ({ roster, players, marketValues }) => {
    const data = useMemo(() => {
        if (!roster || !players) return null;
        const activeIds = activeRosterIds(roster);
        const starters = new Set((roster.starters || []).filter((p) => p && p !== '0'));

        const byPosition = POSITIONS.map((pos) => {
            const group = activeIds
                .map((pid) => players[pid])
                .filter((p) => p?.position === pos && p.age);
            const bands = BANDS.map((b) => ({
                ...b,
                count: group.filter((p) => b.test(p.age)).length,
            }));
            const avgAge = group.length
                ? group.reduce((sum, p) => sum + p.age, 0) / group.length
                : 0;
            return { pos, count: group.length, avgAge, bands };
        });

        let starterValue = 0;
        let benchValue = 0;
        activeIds.forEach((pid) => {
            const v = marketValues?.[pid] || 0;
            if (starters.has(pid)) starterValue += v;
            else benchValue += v;
        });

        return { byPosition, starterValue, benchValue, total: starterValue + benchValue };
    }, [roster, players, marketValues]);

    if (!data) return null;
    const { byPosition, starterValue, benchValue, total } = data;
    const starterPct = total > 0 ? (starterValue / total) * 100 : 0;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-text">Roster Construction</h3>
                </div>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    Age profile by position · where your value sits
                </p>
            </header>

            <div className="p-4 space-y-4">
                {byPosition.map(({ pos, count, avgAge, bands }) => {
                    const max = Math.max(1, ...bands.map((b) => b.count));
                    return (
                        <div key={pos} className="flex items-center gap-3">
                            <span className={`font-mono text-2xs font-bold w-8 shrink-0 ${POS_TONE[pos].text}`}>{pos}</span>
                            <div className="flex-1 grid grid-cols-4 gap-1.5">
                                {bands.map((b) => (
                                    <div key={b.key} className="min-w-0">
                                        <div className="h-8 flex items-end bg-bg-3 rounded-sm overflow-hidden" title={`${b.count} ${pos} aged ${b.label}`}>
                                            <div
                                                className={`w-full ${POS_TONE[pos].bg} ${b.count === 0 ? 'opacity-20' : ''}`}
                                                style={{ height: `${Math.max(6, (b.count / max) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="font-mono text-2xs text-text-mute text-center mt-0.5 tnum">{b.label}</div>
                                    </div>
                                ))}
                            </div>
                            <span className="font-mono text-2xs text-text-dim w-20 text-right shrink-0 tnum">
                                {count ? `${avgAge.toFixed(1)} avg` : '—'}
                            </span>
                        </div>
                    );
                })}

                {total > 0 && (
                    <div className="pt-3 border-t border-line">
                        <div className="flex items-center justify-between font-mono text-2xs uppercase tracking-wider text-text-mute mb-1.5">
                            <span>Starters <span className="tnum text-signal">{starterValue.toLocaleString()}</span></span>
                            <span>Bench <span className="tnum text-text-dim">{benchValue.toLocaleString()}</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-bg-3 overflow-hidden flex" title={`${starterPct.toFixed(0)}% of roster value is in your starting lineup`}>
                            <div className="h-full bg-signal" style={{ width: `${starterPct}%` }} />
                            <div className="h-full bg-text-mute" style={{ width: `${100 - starterPct}%` }} />
                        </div>
                        <p className="text-xs text-text-dim mt-2">
                            <span className="tnum text-text font-semibold">{starterPct.toFixed(0)}%</span> of your
                            market value is in the starting lineup.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default RosterConstruction;
