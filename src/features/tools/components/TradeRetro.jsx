import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { useTradeHistory } from '../hooks/useTradeHistory';
import { fetchMarketValues, getMarketPickValue } from '../../../utils/fantasyCalc';
import { getPickValue, ordinal } from '../utils/pickLedger';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { buildOwnerLookup } from '../../../utils/leagueMath';
import { Pip } from '../../../components/ui/Pip';
import { Skeleton } from '../../../components/ui/Skeleton';

const fmtDate = (ms) => {
    if (!ms) return '';
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Retro-grade every completed trade this season at TODAY's market values —
 * who's ahead now, not who looked good at the time.
 */
const TradeRetro = ({ leagueId, league, rosters, users, players }) => {
    const { trades, loading } = useTradeHistory(leagueId);
    const isSuperflex = league?.roster_positions?.includes('SUPER_FLEX');

    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', leagueId],
        queryFn: () => fetchMarketValues(isSuperflex, rosters?.length || 12, 0.5),
        enabled: !!league,
        staleTime: 60 * 60 * 1000,
    });

    const getOwner = useMemo(() => buildOwnerLookup(rosters, users), [rosters, users]);

    const graded = useMemo(() => {
        if (!trades.length || !players) return [];
        const totalTeams = rosters?.length || 12;

        return trades.map(trade => {
            const sides = (trade.roster_ids || []).map(rosterId => {
                const assets = [];

                Object.entries(trade.adds || {}).forEach(([pid, rid]) => {
                    if (rid !== rosterId) return;
                    const p = players[pid];
                    assets.push({
                        key: `p-${pid}`,
                        label: p ? `${p.first_name} ${p.last_name}` : pid,
                        detail: p ? `${p.position} · ${p.team || 'FA'}` : '',
                        value: marketValues?.[pid] || 0,
                    });
                });

                (trade.draft_picks || []).forEach((dp, i) => {
                    if (dp.owner_id !== rosterId) return;
                    const year = parseInt(dp.season);
                    const value = getMarketPickValue(marketValues, { year, round: dp.round, tier: 'mid' })
                        ?? getPickValue(dp.round, 6, totalTeams, isSuperflex);
                    assets.push({
                        key: `dp-${i}-${dp.season}-${dp.round}-${dp.roster_id}`,
                        label: `${dp.season} ${ordinal(dp.round)}`,
                        detail: 'Pick',
                        value,
                    });
                });

                const total = assets.reduce((sum, a) => sum + a.value, 0);
                return { rosterId, owner: getOwner(rosterId), assets, total };
            });

            const totals = sides.map(s => s.total);
            const max = totals.length ? Math.max(...totals) : 0;
            const min = totals.length ? Math.min(...totals) : 0;
            const leader = sides.find(s => s.total === max);
            // Edge as a share of the total package value — <8% reads as even.
            const edgePct = max + min > 0 ? Math.round(((max - min) / (max + min)) * 100) : 0;

            return {
                id: trade.transaction_id,
                date: trade.created,
                week: trade.leg,
                sides,
                verdict: edgePct < 8
                    ? { label: 'Even', tone: 'text-text-mute' }
                    : { label: `${displayTeamName(leader?.owner)} ahead +${edgePct}%`, tone: 'text-good' },
            };
        });
    }, [trades, players, marketValues, rosters, getOwner, isSuperflex]);

    if (loading) return (
        <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card" aria-busy="true">
            <div className="flex items-center gap-2 mb-4">
                <Scale className="w-5 h-5 text-signal" aria-hidden="true" />
                <h3 className="font-display text-lg font-semibold text-text">Trade Retro</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
        </section>
    );

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-text">Trade Retro</h3>
                </div>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    {league?.season} trades · graded at today's market values
                </p>
            </header>

            {graded.length === 0 ? (
                <p className="p-5 text-sm text-text-dim">No completed trades this season yet.</p>
            ) : (
                <ul className="divide-y divide-line">
                    {graded.map(trade => (
                        <li key={trade.id} className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute tnum">
                                    {fmtDate(trade.date)}{trade.week ? ` · W${trade.week}` : ''}
                                </span>
                                <span className={`font-mono text-2xs font-bold uppercase tracking-wider ${trade.verdict.tone}`}>
                                    {trade.verdict.label}
                                </span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {trade.sides.map(side => (
                                    <div key={side.rosterId} className="rounded-lg border border-line bg-bg-2/60 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            {side.owner?.avatar ? (
                                                <img src={avatarUrl(side.owner.avatar)} alt="" loading="lazy" className="w-6 h-6 rounded-full ring-1 ring-line shrink-0" />
                                            ) : (
                                                <Pip seed={side.owner?.user_id ?? side.rosterId} name={displayTeamName(side.owner)} size={24} />
                                            )}
                                            <span className="text-sm font-semibold text-text truncate">{displayTeamName(side.owner)}</span>
                                            <span className="ml-auto font-mono text-xs tnum text-signal">{side.total.toLocaleString()}</span>
                                        </div>
                                        {side.assets.length === 0 ? (
                                            <p className="text-xs text-text-mute italic">Nothing received</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {side.assets.map(a => (
                                                    <li key={a.key} className="flex items-center gap-2 text-xs">
                                                        <span className="text-text">{a.label}</span>
                                                        <span className="font-mono text-2xs text-text-mute">{a.detail}</span>
                                                        <span className="ml-auto font-mono tnum text-text-dim">{a.value.toLocaleString()}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default TradeRetro;
