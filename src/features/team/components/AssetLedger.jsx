import { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { PlayerHeadshot } from '../../../components/ui/PlayerHeadshot';
import { activeRosterIds } from '../../../utils/leagueMath';
import { buildPickLedger } from '../../tools/utils/pickLedger';

/**
 * Every tradeable asset you own, priced at dynasty market value: players plus
 * future rookie picks, with your total ranked against the league.
 */
const AssetLedger = ({ league, rosters, roster, players, tradedPicks, marketValues, isSuperflex }) => {
    const data = useMemo(() => {
        if (!roster || !players || !rosters?.length) return null;

        const { ledgerByRoster } = buildPickLedger(league, rosters, tradedPicks, marketValues || {}, isSuperflex);

        const rosterValue = (r) =>
            activeRosterIds(r).reduce((sum, pid) => sum + (marketValues?.[pid] || 0), 0);
        const pickValue = (r) =>
            (ledgerByRoster[r.roster_id] || []).reduce((sum, p) => sum + (p.tradeValue || 0), 0);

        const totals = rosters
            .map((r) => ({ rosterId: r.roster_id, total: rosterValue(r) + pickValue(r) }))
            .sort((a, b) => b.total - a.total);
        const rank = totals.findIndex((t) => t.rosterId === roster.roster_id) + 1;

        const myPlayers = activeRosterIds(roster)
            .map((pid) => ({ pid, player: players[pid], value: marketValues?.[pid] || 0 }))
            .filter((p) => p.player)
            .sort((a, b) => b.value - a.value);

        const myPicks = (ledgerByRoster[roster.roster_id] || [])
            .slice()
            .sort((a, b) => (b.tradeValue || 0) - (a.tradeValue || 0));

        return {
            myPlayers,
            myPicks,
            playerTotal: myPlayers.reduce((s, p) => s + p.value, 0),
            pickTotal: myPicks.reduce((s, p) => s + (p.tradeValue || 0), 0),
            rank,
            teamCount: rosters.length,
        };
    }, [league, rosters, roster, players, tradedPicks, marketValues, isSuperflex]);

    if (!data) return null;
    const { myPlayers, myPicks, playerTotal, pickTotal, rank, teamCount } = data;

    if (playerTotal === 0 && pickTotal === 0) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                    <Coins className="w-5 h-5 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-text">Asset Ledger</h3>
                </div>
                <p className="text-sm text-text-dim">Market values are unavailable right now.</p>
            </section>
        );
    }

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-signal" aria-hidden="true" />
                        <h3 className="font-display text-lg font-semibold text-text">Asset Ledger</h3>
                    </div>
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                        Dynasty market value · players + future picks
                    </p>
                </div>
                <div className="text-right">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">League rank</div>
                    <div className={`tnum font-display text-2xl font-bold ${rank === 1 ? 'text-signal' : 'text-text'}`}>
                        #{rank}<span className="text-text-mute text-sm font-normal"> / {teamCount}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                <div className="p-3 text-center">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">Players</div>
                    <div className="tnum font-display text-lg font-bold text-text">{playerTotal.toLocaleString()}</div>
                </div>
                <div className="p-3 text-center">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">Pick capital</div>
                    <div className="tnum font-display text-lg font-bold text-text">{pickTotal.toLocaleString()}</div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
                <div className="p-4">
                    <h4 className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">Top assets</h4>
                    <ul className="space-y-1.5">
                        {myPlayers.slice(0, 8).map(({ pid, player, value }) => (
                            <li key={pid} className="flex items-center gap-2 text-sm">
                                <PlayerHeadshot playerId={pid} name={player.last_name} size={24} />
                                <span className="text-text truncate">{player.first_name?.[0]}. {player.last_name}</span>
                                <span className="font-mono text-2xs text-text-mute">{player.position}</span>
                                <span className="ml-auto font-mono tnum text-signal">{value.toLocaleString()}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-4">
                    <h4 className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">Draft capital</h4>
                    {myPicks.length === 0 ? (
                        <p className="text-sm text-text-dim">No future picks owned.</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {myPicks.slice(0, 8).map((p) => (
                                <li key={p.id} className="flex items-center gap-2 text-sm">
                                    <span className="text-text truncate">{p.description}</span>
                                    <span className="ml-auto font-mono tnum text-text-dim">
                                        {(p.tradeValue || 0).toLocaleString()}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
};

export default AssetLedger;
