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

const phaseFor = ({ market, youth, capital, production }) => {
    const winNow = (market + production) / 2;
    const future = (youth + capital) / 2;
    if (winNow >= 0.6 && future >= 0.5) return { label: 'Apex', tone: 'text-signal' };
    if (winNow >= 0.6) return { label: 'Win Now', tone: 'text-good' };
    if (future >= 0.6) return { label: 'Rebuilding', tone: 'text-text-dim' };
    if (winNow <= 0.35 && future <= 0.35) return { label: 'Stuck', tone: 'text-bad' };
    return { label: 'In Between', tone: 'text-text-mute' };
};

const Bar = ({ pct, className }) => (
    <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
);

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

    const teams = useMemo(() => {
        if (!league || !rosters?.length || !players) return [];

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

        return raw
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
                return { ...t, ...parts, score, phase: phaseFor(parts) };
            })
            .sort((a, b) => b.score - a.score);
    }, [league, rosters, users, players, tradedPicks, marketValues, isSuperflex]);

    if (teams.length === 0) return null;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="flex items-center gap-2">
                    <Hourglass className="w-5 h-5 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-text">Dynasty Window</h3>
                </div>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    Roster Value · Production · Youth · Pick Capital
                </p>
            </header>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2">
                            <th className="px-3 py-2.5 w-10 text-center">#</th>
                            <th className="px-3 py-2.5">Team</th>
                            <th className="px-3 py-2.5 text-center w-16">Window</th>
                            <th className="px-3 py-2.5 hidden md:table-cell w-24">Value</th>
                            <th className="px-3 py-2.5 hidden md:table-cell w-24">Youth</th>
                            <th className="px-3 py-2.5 hidden md:table-cell w-24">Picks</th>
                            <th className="px-3 py-2.5 text-right w-28">Phase</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((t, idx) => (
                            <tr key={t.rosterId} className="border-b border-line hover:bg-bg-2/60 transition-colors duration-fast">
                                <td className={`px-3 py-3 tnum font-bold text-center ${idx === 0 ? 'text-signal' : 'text-text-mute'}`}>
                                    {idx + 1}
                                </td>
                                <td className="px-3 py-3 text-text">
                                    <div className="flex items-center gap-2">
                                        {t.owner?.avatar ? (
                                            <img src={avatarUrl(t.owner.avatar)} alt="" loading="lazy" className="w-7 h-7 rounded-full ring-1 ring-line shrink-0" />
                                        ) : (
                                            <Pip seed={t.owner?.user_id ?? t.rosterId} name={displayTeamName(t.owner)} size={28} />
                                        )}
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold truncate max-w-[140px] sm:max-w-none">{displayTeamName(t.owner)}</div>
                                            <div className="font-mono text-2xs text-text-mute tnum">
                                                {t.avgAge ? `${t.avgAge.toFixed(1)} avg age` : '—'}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className="tnum font-display text-lg font-bold text-text">{t.score}</span>
                                </td>
                                <td className="px-3 py-3 hidden md:table-cell"><Bar pct={t.market} className="bg-signal" /></td>
                                <td className="px-3 py-3 hidden md:table-cell"><Bar pct={t.youth} className="bg-good" /></td>
                                <td className="px-3 py-3 hidden md:table-cell"><Bar pct={t.capital} className="bg-text-mute" /></td>
                                <td className={`px-3 py-3 text-right font-mono text-2xs font-bold uppercase tracking-wider ${t.phase.tone}`}>
                                    {t.phase.label}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default DynastyWindow;
