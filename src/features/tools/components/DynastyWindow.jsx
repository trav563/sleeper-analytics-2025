import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hourglass } from 'lucide-react';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { activeRosterIds } from '../../../utils/leagueMath';
import { buildPickLedger } from '../utils/pickLedger';
import { Pip } from '../../../components/ui/Pip';

const normalize = (values) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 0.5);
    return values.map((v) => (v - min) / (max - min));
};

/**
 * Phase labels match the Competitive Window card's quadrant names so the two
 * adjacent cards stop using different words for the same idea.
 *
 * `hasProduction` matters: before kickoff production normalizes to a neutral
 * 0.5 for everyone, and averaging that into the win-now axis would compress
 * it to 0.25-0.75 and let a team read "Win-Now" on roster value alone.
 */
const phaseFor = ({ market, youth, capital, production }, hasProduction) => {
    const winNow = hasProduction ? (market + production) / 2 : market;
    const future = (youth + capital) / 2;
    if (winNow >= 0.6 && future >= 0.5) return { label: 'Dynasty Elite', tone: 'text-signal' };
    if (winNow >= 0.6) return { label: 'Win-Now', tone: 'text-good' };
    if (future >= 0.6) return { label: 'Rebuilder', tone: 'text-text-dim' };
    if (winNow <= 0.35 && future <= 0.35) return { label: 'Danger Zone', tone: 'text-bad' };
    return { label: 'In Between', tone: 'text-text-mute' };
};

/** Segment colours for the composite bar, in draw order. */
const COMPONENTS = [
    { key: 'market', label: 'Value', css: 'var(--signal)' },
    { key: 'production', label: 'Production', css: 'var(--signal-2)' },
    { key: 'youth', label: 'Youth', css: 'var(--good)' },
    { key: 'capital', label: 'Picks', css: 'var(--text-mute)' },
];

const scoreTone = (score) =>
    score >= 70 ? 'text-good' : score >= 45 ? 'text-signal' : 'text-text-dim';

/**
 * Dynasty Window — one composite view reconciling the app's three
 * contender/rebuild signals. Per team:
 *   market     — FantasyCalc value of the active roster
 *   production — Max PF per game this season (0-weighted in the offseason)
 *   youth      — inverse average age of active skill players
 *   capital    — market value of owned future rookie picks
 */
const DynastyWindow = ({ league, rosters, users, players, tradedPicks }) => {
    const isSuperflex = league?.roster_positions?.includes('SUPER_FLEX');

    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', league?.league_id],
        queryFn: () => fetchMarketValues(isSuperflex, rosters?.length || 12, 0.5),
        enabled: !!league,
        staleTime: 60 * 60 * 1000,
    });

    const { rows: teams, weights, hasProduction, hasMarket } = useMemo(() => {
        const empty = { rows: [], weights: {}, hasProduction: false, hasMarket: false };
        if (!league || !rosters?.length || !players) return empty;

        const { ledgerByRoster } = buildPickLedger(league, rosters, tradedPicks, marketValues || {}, isSuperflex);

        const raw = rosters.map((roster) => {
            const activeIds = activeRosterIds(roster);

            const marketValue = marketValues
                ? activeIds.reduce((sum, pid) => sum + (marketValues[pid] || 0), 0)
                : 0;

            const skill = activeIds
                .map((pid) => players[pid])
                .filter((p) => p && ['QB', 'RB', 'WR', 'TE'].includes(p.position) && p.age);
            const avgAge = skill.length
                ? skill.reduce((sum, p) => sum + p.age, 0) / skill.length
                : 0;

            const s = roster.settings || {};
            const gp = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
            const maxPf = (s.ppts || 0) + (s.ppts_decimal || 0) / 100;
            const production = gp > 0 ? maxPf / gp : 0;

            const capital = (ledgerByRoster[roster.roster_id] || [])
                .reduce((sum, p) => sum + (p.tradeValue || 0), 0);

            const owner = users?.find((u) => u.user_id === roster.owner_id);
            return { rosterId: roster.roster_id, owner, marketValue, avgAge, production, capital };
        });

        const hasProduction = raw.some((t) => t.production > 0);
        const hasMarket = raw.some((t) => t.marketValue > 0);

        const normMarket = normalize(raw.map((t) => t.marketValue));
        const normYouth = normalize(raw.map((t) => -t.avgAge)); // younger = higher
        const normCapital = normalize(raw.map((t) => t.capital));
        const normProduction = normalize(raw.map((t) => t.production));

        // Production drops out in the offseason; market drops out if
        // FantasyCalc is unreachable. Reweight the rest.
        const weights = {
            market: hasMarket ? 0.3 : 0,
            production: hasProduction ? 0.3 : 0,
            youth: 0.2,
            capital: 0.2,
        };
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

        const rows = raw
            .map((t, i) => {
                const parts = {
                    market: normMarket[i],
                    youth: normYouth[i],
                    capital: normCapital[i],
                    production: normProduction[i],
                };
                const score = Math.round(
                    ((parts.market * weights.market +
                        parts.production * weights.production +
                        parts.youth * weights.youth +
                        parts.capital * weights.capital) / totalWeight) * 100
                );
                // Each segment's width IS its weighted contribution, so the
                // bar's total length equals the score and its mix explains it.
                const segments = COMPONENTS.map((c) => ({
                    ...c,
                    pct: (parts[c.key] * weights[c.key]) / totalWeight * 100,
                }));
                return { ...t, ...parts, score, segments, phase: phaseFor(parts, hasProduction) };
            })
            .sort((a, b) => b.score - a.score);
        return { rows, weights, hasProduction, hasMarket };
    }, [league, rosters, users, players, tradedPicks, marketValues, isSuperflex]);

    if (teams.length === 0) return null;

    const activeComponents = COMPONENTS.filter((c) => (weights[c.key] || 0) > 0);
    const pct = (k) => Math.round((weights[k] / Object.values(weights).reduce((a, b) => a + b, 0)) * 100);

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="flex items-center gap-2">
                    <Hourglass className="w-5 h-5 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-text">Dynasty Window</h3>
                </div>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    Bar length = score · segments show what it's made of
                </p>

                <details className="mt-2 group">
                    <summary className="cursor-pointer font-mono text-2xs uppercase tracking-wider text-text-dim hover:text-signal transition-colors duration-fast list-none inline-flex items-center gap-1 select-none">
                        <span className="group-open:rotate-90 transition-transform duration-fast inline-block">›</span>
                        How is this calculated?
                    </summary>
                    <div className="mt-3 p-3 rounded-md bg-bg-2 border border-line text-xs text-text-dim leading-relaxed space-y-1.5">
                        <p>
                            Window is a 0–100 score of how well a roster is set up to win — now and later.
                            Each input is scored <span className="text-text font-semibold">relative to this league</span>:
                            the best team in a category gets full credit, the worst gets none. It is not an absolute
                            grade and can't be compared across leagues.
                        </p>
                        <ul className="space-y-1 mt-1">
                            <li>• <span className="text-text font-semibold">Value</span> ({pct('market')}%) — dynasty market value of the active roster (taxi and IR excluded)</li>
                            <li>• <span className="text-text font-semibold">Production</span> ({pct('production')}%) — best-possible lineup points per game, so start/sit luck doesn't count</li>
                            <li>• <span className="text-text font-semibold">Youth</span> ({pct('youth')}%) — inverse average age of active QB/RB/WR/TE</li>
                            <li>• <span className="text-text font-semibold">Picks</span> ({pct('capital')}%) — market value of rookie picks owned for the next two drafts</li>
                        </ul>
                        {!hasProduction && (
                            <p className="text-text-mute">
                                No games have been played yet, so Production is excluded and the other weights
                                are scaled up to fill it.
                            </p>
                        )}
                        {!hasMarket && (
                            <p className="text-text-mute">Market values are unavailable, so Value is excluded.</p>
                        )}
                        <p className="text-text-mute">
                            Phase reads two axes: win-now (value + production) against future (youth + picks).
                        </p>
                    </div>
                </details>
            </header>

            <ul className="divide-y divide-line">
                {teams.map((t, idx) => (
                    <li key={t.rosterId} className="px-3 py-3 hover:bg-bg-2/60 transition-colors duration-fast">
                        <div className="flex items-center gap-2.5">
                            <span className={`tnum font-bold text-center w-5 shrink-0 ${idx === 0 ? 'text-signal' : 'text-text-mute'}`}>
                                {idx + 1}
                            </span>
                            {t.owner?.avatar ? (
                                <img src={avatarUrl(t.owner.avatar)} alt="" loading="lazy" className="w-7 h-7 rounded-full ring-1 ring-line shrink-0" />
                            ) : (
                                <Pip seed={t.owner?.user_id ?? t.rosterId} name={displayTeamName(t.owner)} size={28} />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-text truncate">{displayTeamName(t.owner)}</div>
                                <div className="font-mono text-2xs text-text-mute tnum">
                                    {t.avgAge ? `${t.avgAge.toFixed(1)} avg age` : '—'}
                                </div>
                            </div>
                            <span className={`font-mono text-2xs font-bold uppercase tracking-wider shrink-0 ${t.phase.tone}`}>
                                {t.phase.label}
                            </span>
                            <span className={`tnum font-display text-xl font-extrabold w-9 text-right shrink-0 ${scoreTone(t.score)}`}>
                                {t.score}
                            </span>
                        </div>

                        {/* The bar IS the score: total length = 0-100, and each
                            segment is that input's weighted contribution. */}
                        <div
                            className="mt-2 h-2.5 rounded-full bg-bg-3 overflow-hidden flex"
                            role="img"
                            aria-label={`Window ${t.score} of 100. ${t.segments
                                .filter((sg) => sg.pct > 0)
                                .map((sg) => `${sg.label} ${Math.round(sg.pct)}`)
                                .join(', ')}.`}
                        >
                            {t.segments.map((sg) => (
                                sg.pct > 0 ? (
                                    <div
                                        key={sg.key}
                                        className="h-full"
                                        style={{ width: `${sg.pct}%`, background: sg.css }}
                                        title={`${sg.label}: ${Math.round(sg.pct)} of ${t.score}`}
                                    />
                                ) : null
                            ))}
                        </div>
                    </li>
                ))}
            </ul>

            <div className="px-3 py-3 border-t border-line flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-2xs uppercase tracking-wider text-text-mute">
                {activeComponents.map((c) => (
                    <span key={c.key} className="inline-flex items-center gap-1.5">
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: `color-mix(in srgb, ${c.css} 40%, transparent)`, border: `1px solid ${c.css}` }}
                        />
                        {c.label} <span className="text-text-dim">{pct(c.key)}%</span>
                    </span>
                ))}
            </div>
        </section>
    );
};

export default DynastyWindow;
