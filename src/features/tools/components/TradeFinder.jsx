import { useToolState } from '../../../hooks/useToolState';
import { useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { useMarketValues } from '../hooks/useMarketValues';
import { buildPickLedger } from '../utils/pickLedger';
import { generateTradeCandidates, classifyTeams, formatChange, STRATEGY_LABELS, JUDGED_ON, PRIME_AGE_END, CONSOLIDATION_PREMIUM, TRADE_VALUE_TOLERANCE, MIN_STRATEGY_GAIN } from '../../../utils/tradeCandidates';
import { tradeWindowOpen } from '../../../utils/valuation';
import { displayTeamName } from '../../../utils/nflData';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

const MODES = {
    'trade-up': { label: 'Trade up', hint: 'Send two assets, get one better one back.', empty: 'trade-up packages' },
    swap: { label: 'Swap', hint: 'One-for-one trades that fit both rosters.', empty: 'swaps' },
    'trade-down': { label: 'Trade down', hint: 'Send one asset, get two back.', empty: 'trade-down deals' },
};
const SLOT_NAMES = { SUPER_FLEX: 'Superflex', WRRB_FLEX: 'W/R flex', REC_FLEX: 'W/T flex', FLEX: 'Flex' };
const pct = x => `${Math.round(x * 100)}%`;
const points = x => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x)).toLocaleString()} pts`;
const tone = x => x > 0 ? 'text-good' : x < 0 ? 'text-bad' : 'text-text';

/** Fairness in words: who pays, how much, and the band the screen allows. */
function fairness(o) {
    const youPay = o.give.length >= o.receive.length;
    const ratio = youPay ? o.giveValue / o.receiveValue : o.receiveValue / o.giveValue;
    const floor = o.give.length === o.receive.length ? 0 : CONSOLIDATION_PREMIUM;
    return `${youPay ? 'You pay' : 'They pay'} ${pct(ratio)} of what ${youPay ? 'you get' : 'they get'} in dynasty value. Fair range for ${o.give.length === o.receive.length ? 'one-for-one' : 'two-for-one'}: ${pct(1 + floor)}–${pct(1 + floor + TRADE_VALUE_TOLERANCE)}.`;
}

/** Every number on an offer card, explained from the same constants the screen uses. */
function ValueGuide({ settings, slots }) {
    const premium = pct(CONSOLIDATION_PREMIUM);
    const primes = Object.entries(PRIME_AGE_END).map(([pos, age]) => `${pos} ${age}`).join(', ');
    const items = [
        [settings.isDynasty ? 'Dynasty value' : 'Value', `FantasyCalc’s trade-market price for a ${settings.numQbs === 2 ? 'superflex' : '1QB'}, ${settings.numTeams}-team, ${settings.ppr} PPR ${settings.isDynasty ? 'dynasty' : 'redraft'} league. Elite players are worth about 10,000.${settings.isDynasty ? ' It already reflects age and long-term outlook.' : ''} It is used only to check that a deal is fair.`],
        ['Fair price', `One-for-one: you pay ${pct(1)}–${pct(1 + TRADE_VALUE_TOLERANCE)} of what you get. Two-for-one: the team getting the single best piece pays ${pct(1 + CONSOLIDATION_PREMIUM)}–${pct(1 + CONSOLIDATION_PREMIUM + TRADE_VALUE_TOLERANCE)}, because one star is worth more than two lesser players.`],
        ...(settings.isDynasty ? [['This-season value', 'FantasyCalc’s redraft (rest-of-season) price. Picks are 0 because they don’t play this year.']] : []),
        ['This season change', `The change in the total ${settings.isDynasty ? 'this-season ' : ''}value of a team’s best legal starting lineup (${slots}). A player only counts if he would start.`],
        ...(settings.isDynasty ? [
            ['Future change', `The change in dynasty value of the whole roster plus picks, with older players marked down: past ${primes}, value drops 15% per year (to no less than 35%), since a rebuild takes a few seasons. A team taking two-for-one has what it receives divided by ${(1 + CONSOLIDATION_PREMIUM).toFixed(2)}, so the ${premium} premium it was paid doesn’t count as a gain.`],
            ['Plans', `Contenders are judged on this season, rebuilders on future value, and balanced teams on the average of both. Each team must gain at least ${pct(MIN_STRATEGY_GAIN)} on its own measure, shown in bold. Auto picks the plan from record, points scored and this-season lineup strength; partners are always on Auto.`],
        ] : [['Fit', `Each team’s starting lineup must improve by at least ${pct(MIN_STRATEGY_GAIN)}.`]]),
        ['Value points (pts)', 'The small number under each percentage is the raw change, on the same scale as player values, so you can check it against the players above.'],
    ];
    return <details className="rounded-lg border border-line bg-bg-2 text-sm">
        <summary className="cursor-pointer px-3 py-3 font-semibold">How these numbers work</summary>
        <dl className="px-3 pb-3 space-y-3">{items.map(([term, text]) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="text-text-dim mt-0.5">{text}</dd></div>)}</dl>
    </details>;
}

export default function TradeFinder({ league, rosters, users, players, state, tradedPicks }) {
    const { user } = useSleeper();
    const [chosen, setChosen] = useToolState(`finder-team:${league.league_id}`, null);
    const [mode, setMode] = useToolState(`finder-mode:${league.league_id}`, 'trade-up');
    const [overrides, setOverrides] = useToolState(`finder-strategy:${league.league_id}`, {});
    const rosterId = rosters.some(r => r.roster_id === chosen) ? chosen : (rosters.find(r => r.owner_id === user?.user_id) || rosters[0])?.roster_id;
    const override = overrides[rosterId] || 'auto';
    const { snapshot, settings, isLoading, refetch } = useMarketValues(league, rosters.length);
    const winNow = useMarketValues(league, rosters.length, { isDynasty: false });
    const shape = MODES[mode] ? mode : 'trade-up';
    const picks = useMemo(() => buildPickLedger(league, rosters, tradedPicks, snapshot?.values || {}, settings.numQbs === 2).allPicks, [league, rosters, tradedPicks, snapshot, settings.numQbs]);
    const strategies = useMemo(() => snapshot?.trustworthy ? classifyTeams({ league, rosters, players, snapshot, winNowSnapshot: winNow.snapshot, picks }) : {}, [league, rosters, players, snapshot, winNow.snapshot, picks]);
    const offers = useMemo(() => generateTradeCandidates({ league, rosters, players, snapshot, winNowSnapshot: winNow.snapshot, picks, rosterId, mode: shape, state, strategyOverride: override === 'auto' ? null : override }),
        [league, rosters, players, snapshot, winNow.snapshot, picks, rosterId, shape, state, override]);
    const teamName = id => displayTeamName(users.find(u => u.user_id === rosters.find(r => r.roster_id === id)?.owner_id));
    const loading = isLoading || (settings.isDynasty && winNow.isLoading);
    const assetDetail = (p, holder) => p.kind === 'pick'
        ? `Draft pick · ${p.original_owner_id === holder ? 'own' : `via ${teamName(p.original_owner_id)}`}`
        : `${p.position}${p.ownershipStatus !== 'Active' ? ` · ${p.ownershipStatus}` : ''}${p.age ? ` · ${p.age}yo` : ''}`;
    const slots = (league.roster_positions || []).filter(s => !['BN', 'IR', 'K', 'DEF'].includes(s)).map(s => SLOT_NAMES[s] || s).join(', ');
    return <section className="bg-bg-1 border border-line rounded-xl p-4 sm:p-5 space-y-5">
        <header><h2 className="text-xl font-bold">Trade Finder</h2><p className="text-sm text-text-dim mt-1">{settings.isDynasty ? 'Offers built around each team’s plan: contenders add win-now production, rebuilders add youth and picks. ' : ''}Every offer is fair by market value. IR/taxi ownership is separate from weekly availability.</p></header>
        <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">Your team<select aria-label="Trade Finder team" value={rosterId || ''} onChange={e => setChosen(Number(e.target.value))} className="block w-full min-h-11 mt-2 rounded-md bg-bg-2 border border-line px-3">{rosters.map(r => <option key={r.roster_id} value={r.roster_id}>{teamName(r.roster_id)}</option>)}</select></label>
            {settings.isDynasty && <label className="block text-sm">Your approach<select aria-label="Trade Finder approach" value={override} onChange={e => setOverrides(prev => ({ ...prev, [rosterId]: e.target.value }))} className="block w-full min-h-11 mt-2 rounded-md bg-bg-2 border border-line px-3">
                <option value="auto">Auto · {strategies[rosterId] ? STRATEGY_LABELS[strategies[rosterId]] : 'detecting'}</option>
                <option value="contender">Contend now</option><option value="balanced">Balanced</option><option value="rebuilder">Rebuild</option>
            </select></label>}
        </div>
        {settings.isDynasty && <p className="text-xs text-text-dim -mt-2">Auto uses record, points scored, and this season’s starting-lineup strength. Contenders weigh this season’s lineup; rebuilders weigh age-adjusted future value and picks.</p>}
        <div className="space-y-2"><SegmentedTabs tabs={Object.entries(MODES).map(([value, m]) => ({ value, label: m.label }))} value={shape} onChange={setMode} label="Trade shape" /><p className="text-xs text-text-dim">{MODES[shape].hint}</p></div>
        <p className="text-xs text-text-dim">{snapshot?.source || 'Loading market values'}{snapshot?.fetchedAt ? ` · retrieved ${new Date(snapshot.fetchedAt).toLocaleString()}` : ''}. Market values set fairness{settings.isDynasty ? ' and already price in dynasty age' : ''}.{settings.isDynasty ? winNow.snapshot?.trustworthy ? ` This-season values: ${winNow.snapshot.source} redraft.` : ' This-season values are unavailable, so lineup strength uses dynasty values.' : ''} {snapshot?.approximation}</p>
        {snapshot?.trustworthy && <ValueGuide settings={settings} slots={slots} />}
        {!tradeWindowOpen(league, state) ? <p className="text-warn text-sm">Trading is closed for this season or past the league deadline. No actionable offers are shown.</p>
            : loading ? <p role="status">Screening roster fits…</p>
            : !snapshot?.trustworthy ? <div role="status"><p>Market values are unavailable. Precise trade recommendations are paused.</p><button className="min-h-11 text-signal" onClick={() => refetch()}>Retry market values</button></div>
            : offers.length === 0 ? <p className="text-sm text-text-dim py-4">No {MODES[shape].empty} passed the checks for this plan. Each offer must be fair by market value and improve both teams by their own plan, without leaving a starting slot empty.</p>
            : <div className="space-y-4">{offers.map(o => <article key={o.opponentRosterId} className="border border-line rounded-lg p-4 space-y-4">
                <h3 className="font-bold flex flex-wrap items-center gap-2">With {teamName(o.opponentRosterId)}<span className="font-mono text-2xs uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm border border-line text-text-dim">{STRATEGY_LABELS[o.them.strategy]}</span></h3>
                <div className="grid sm:grid-cols-2 gap-4">{[['You send', o.give, o.giveValue, rosterId], ['You receive', o.receive, o.receiveValue, o.opponentRosterId]].map(([label, assets, total, holder]) => <div key={label}>
                    <h4 className="text-sm text-signal mb-2">{label}</h4>
                    <ul>{assets.map(p => <li key={p.id} className="text-sm py-1"><strong>{p.kind === 'pick' ? p.name : `${p.first_name} ${p.last_name}`}</strong>
                        <span className="block text-xs text-text-dim">{assetDetail(p, holder)}</span>
                        <span className="block text-xs text-text-dim tnum">{settings.isDynasty ? `Dynasty ${p.tradeValue.toLocaleString()} · This season ${(p.winNowValue || 0).toLocaleString()}` : `Value ${p.tradeValue.toLocaleString()}`}</span></li>)}</ul>
                    <p className="text-xs mt-2">{settings.isDynasty ? 'Dynasty total' : 'Total value'}: <span className="tnum">{total.toLocaleString()}</span></p>
                </div>)}</div>
                <p className="text-xs text-text-dim">{fairness(o)}</p>
                <table className="w-full text-sm">
                    <caption className="sr-only">How each team’s roster changes</caption>
                    <thead><tr className="text-xs text-text-dim"><th scope="col" className="text-left font-normal pb-1">Roster change</th><th scope="col" className="text-right font-normal pb-1 pl-3">This season</th>{settings.isDynasty && <th scope="col" className="text-right font-normal pb-1 pl-3">Future</th>}</tr></thead>
                    <tbody>{[['You', o.me], [teamName(o.opponentRosterId), o.them]].map(([who, side]) => <tr key={who} className="border-t border-line align-top">
                        <th scope="row" className="text-left font-normal py-2 break-words">{who}<span className="block text-xs text-text-dim">{STRATEGY_LABELS[side.strategy]}</span></th>
                        {[['now', side.nowChange, side.nowDelta], ['future', side.futureChange, side.futureDelta]].filter(([k]) => settings.isDynasty || k === 'now').map(([k, change, delta]) => <td key={k} className="text-right py-2 pl-3 tnum whitespace-nowrap">
                            <span className={JUDGED_ON[side.strategy].includes(k) ? `font-semibold ${tone(change)}` : 'text-text-dim'}>{formatChange(change)}</span>
                            <span className="block text-xs text-text-dim">{points(delta)}</span></td>)}
                    </tr>)}</tbody>
                </table>
                <p className="text-xs text-text-dim">Bold is what each team’s plan is judged on. Market-fit estimate, not a guarantee of acceptance or a weekly points projection.</p>
            </article>)}</div>}
    </section>;
}
