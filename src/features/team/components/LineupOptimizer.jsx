import { useMemo } from 'react';
import { Sliders, ArrowRight, AlertTriangle } from 'lucide-react';
import { PlayerHeadshot } from '../../../components/ui/PlayerHeadshot';
import { getByeMap } from '../../../utils/nflData';

/** Which players may fill a given lineup slot. */
const SLOT_ELIGIBILITY = {
    QB: ['QB'],
    RB: ['RB'],
    WR: ['WR'],
    TE: ['TE'],
    K: ['K'],
    DEF: ['DEF'],
    FLEX: ['RB', 'WR', 'TE'],
    WRRB_FLEX: ['RB', 'WR'],
    REC_FLEX: ['WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};

const OUT_STATUSES = new Set(['Out', 'IR', 'PUP', 'Sus', 'NA', 'Doubtful']);

/**
 * Greedy optimal lineup by projected points: fill the most constrained slots
 * first (fewest eligible positions), highest projection first. Not a perfect
 * assignment solver, but for real fantasy rosters it matches one.
 */
function buildOptimalLineup(slots, available, projFor) {
    const remaining = [...available];
    const order = slots
        .map((slot, i) => ({ slot, i, width: (SLOT_ELIGIBILITY[slot] || []).length }))
        .filter((s) => SLOT_ELIGIBILITY[s.slot])
        .sort((a, b) => a.width - b.width);

    const assigned = {};
    for (const { slot, i } of order) {
        const eligible = SLOT_ELIGIBILITY[slot];
        let bestIdx = -1;
        let bestPts = -1;
        remaining.forEach((p, idx) => {
            if (!eligible.includes(p.position)) return;
            const pts = projFor(p.pid);
            if (pts > bestPts) { bestPts = pts; bestIdx = idx; }
        });
        if (bestIdx >= 0) {
            assigned[i] = { ...remaining[bestIdx], proj: bestPts };
            remaining.splice(bestIdx, 1);
        }
    }
    return assigned;
}

/**
 * Start/sit for the upcoming week: current starters vs the projection-optimal
 * lineup, plus bye and injury flags.
 */
const LineupOptimizer = ({ league, roster, players, week, projFor }) => {
    const byeMap = useMemo(() => getByeMap(league?.season), [league?.season]);
    const byeTeams = useMemo(() => new Set(byeMap[week] || []), [byeMap, week]);

    const analysis = useMemo(() => {
        if (!roster || !players || !league?.roster_positions) return null;

        const slots = league.roster_positions;
        const inactive = new Set([...(roster.taxi || []), ...(roster.reserve || [])]);
        const pool = (roster.players || [])
            .filter((pid) => !inactive.has(pid))
            .map((pid) => {
                const p = players[pid];
                if (!p) return null;
                return {
                    pid,
                    name: `${p.first_name} ${p.last_name}`,
                    position: p.position,
                    team: p.team,
                    injury: p.injury_status || p.status,
                };
            })
            .filter(Boolean);

        const optimal = buildOptimalLineup(slots, pool, projFor);
        const current = (roster.starters || []).map((pid, i) => {
            if (!pid || pid === '0') return { slot: slots[i], i, empty: true };
            const p = players[pid];
            return {
                slot: slots[i],
                i,
                pid,
                name: p ? `${p.first_name} ${p.last_name}` : pid,
                position: p?.position,
                team: p?.team,
                injury: p?.injury_status || p?.status,
                proj: projFor(pid),
            };
        });

        const swaps = [];
        let currentTotal = 0;
        let optimalTotal = 0;
        current.forEach((c) => {
            if (!SLOT_ELIGIBILITY[c.slot]) return; // bench/IR rows
            const best = optimal[c.i];
            currentTotal += c.proj || 0;
            optimalTotal += best?.proj || 0;
            if (best && best.pid !== c.pid && (best.proj - (c.proj || 0)) > 0.5) {
                swaps.push({ slot: c.slot, out: c, in: best, gain: best.proj - (c.proj || 0) });
            }
        });

        const alerts = current.filter(
            (c) => SLOT_ELIGIBILITY[c.slot] && !c.empty &&
                (byeTeams.has(c.team) || OUT_STATUSES.has(c.injury))
        ).map((c) => ({
            ...c,
            reason: byeTeams.has(c.team) ? 'On bye' : c.injury,
        }));

        return { swaps: swaps.sort((a, b) => b.gain - a.gain), alerts, currentTotal, optimalTotal };
    }, [roster, players, league, projFor, byeTeams]);

    if (!analysis) return null;
    const { swaps, alerts, currentTotal, optimalTotal } = analysis;
    const gain = optimalTotal - currentTotal;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-signal" aria-hidden="true" />
                        <h3 className="font-display text-lg font-semibold text-text">Start / Sit · Week {week}</h3>
                    </div>
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                        Your lineup vs the projection-optimal one
                    </p>
                </div>
                <div className="flex items-center gap-4 font-mono text-2xs uppercase tracking-wider">
                    <div className="text-right">
                        <div className="text-text-mute">Current</div>
                        <div className="tnum font-display text-lg font-bold text-text">{currentTotal.toFixed(1)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-text-mute">Optimal</div>
                        <div className={`tnum font-display text-lg font-bold ${gain > 0.5 ? 'text-signal' : 'text-good'}`}>
                            {optimalTotal.toFixed(1)}
                        </div>
                    </div>
                </div>
            </header>

            {alerts.length > 0 && (
                <div className="px-4 py-3 border-b border-line bg-bad/5">
                    <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-bad mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Needs attention
                    </div>
                    <ul className="space-y-1.5">
                        {alerts.map((a) => (
                            <li key={a.pid} className="flex items-center gap-2 text-sm">
                                <PlayerHeadshot playerId={a.pid} name={a.name} size={24} />
                                <span className="text-text">{a.name}</span>
                                <span className="font-mono text-2xs uppercase tracking-wider text-bad ml-auto">{a.reason}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {swaps.length === 0 ? (
                <p className="p-5 text-sm text-text-dim">
                    Your lineup already matches the projection-optimal one. Nothing to change.
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {swaps.map((s) => (
                        <li key={s.slot + s.out.pid} className="p-3 flex items-center gap-3">
                            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-signal bg-signal/15 px-2 py-0.5 rounded-sm w-16 text-center shrink-0">
                                {s.slot}
                            </span>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <PlayerHeadshot playerId={s.out.pid} name={s.out.name} size={24} />
                                <span className="text-sm text-text-dim line-through truncate">{s.out.name || 'Empty'}</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-text-mute shrink-0" aria-hidden="true" />
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <PlayerHeadshot playerId={s.in.pid} name={s.in.name} size={24} />
                                <span className="text-sm text-text font-semibold truncate">{s.in.name}</span>
                            </div>
                            <span className="font-mono text-2xs tnum text-good shrink-0">+{s.gain.toFixed(1)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default LineupOptimizer;
