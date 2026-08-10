import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTradeAnalysis } from '../hooks/useTradeAnalysis';
import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { RefreshCw, TrendingUp, TrendingDown, ArrowRightLeft, User, Lock } from 'lucide-react';
import { Pip } from '../../../components/ui/Pip';

const STATUS_TONE = {
    Contender: 'text-good bg-good/10 border-good/20',
    Rebuilder: 'text-signal-2 bg-signal-2/10 border-signal-2/20',
};
const defaultStatusTone = 'text-text-dim bg-bg-3 border-line';

const TradeFinder = ({ leagueId, currentWeek, rosters, users, players, league, tradedPicks, state }) => {
    const { user } = useSleeper();
    const { seasonMatchups, loading: matchupsLoading } = useSeasonMatchups(leagueId, currentWeek);

    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', leagueId],
        queryFn: () => fetchMarketValues(
            league?.roster_positions?.includes('SUPER_FLEX'),
            rosters?.length || 12,
            0.5
        ),
        staleTime: 60 * 60 * 1000,
    });

    const isTradeWindowOpen = useMemo(() => {
        if (!league?.settings?.trade_deadline) return true;
        if (!state?.week) return true;
        return state.week <= league.settings.trade_deadline;
    }, [league, state]);

    const { teamAnalysis, findMatches } = useTradeAnalysis(
        league, rosters, players, seasonMatchups, currentWeek, tradedPicks,
        marketValues,
        isTradeWindowOpen
    );

    const [selectedRosterId, setSelectedRosterId] = useState(null);

    useEffect(() => {
        if (!selectedRosterId && rosters && rosters.length > 0) {
            if (user) {
                const userRoster = rosters.find(r => r.owner_id === user.user_id);
                if (userRoster) {
                    setSelectedRosterId(userRoster.roster_id);
                    return;
                }
            }
            setSelectedRosterId(rosters[0].roster_id);
        }
    }, [rosters, user, selectedRosterId]);

    const focusTeam = teamAnalysis[selectedRosterId];
    const matches = useMemo(() => findMatches(selectedRosterId), [selectedRosterId, findMatches]);

    if (matchupsLoading && !focusTeam) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line p-8 shadow-card">
                <div className="text-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                    Analyzing league market…
                </div>
            </section>
        );
    }

    if (!focusTeam) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line p-8 shadow-card">
                <div className="text-center text-text-dim space-y-2">
                    <ArrowRightLeft className="w-7 h-7 mx-auto opacity-50" />
                    <p className="text-sm">Select a roster to view trade suggestions.</p>
                </div>
            </section>
        );
    }

    const getOwner = (rosterId) => users.find(u => u.user_id === rosters.find(r => r.roster_id === rosterId)?.owner_id);
    const focusOwner = getOwner(selectedRosterId);

    return (
        <section className="space-y-5">
            {!isTradeWindowOpen && (
                <div className="bg-warn/10 border border-warn/30 rounded-md p-4 flex items-center gap-3">
                    <Lock className="w-5 h-5 text-warn shrink-0" />
                    <div>
                        <h4 className="text-warn font-bold text-sm">
                            Trade Deadline Passed (Week <span className="tnum">{league.settings.trade_deadline}</span>)
                        </h4>
                        <p className="text-text-dim text-xs">
                            Trading is closed based on league settings. Evaluation switched to "Offseason Mode" (dynasty value focus).
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3 h-3 text-signal" aria-hidden="true" />
                        Tool · {isTradeWindowOpen ? 'Trade Finder' : 'Offseason Planner'}
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold tracking-snug text-text">
                        {isTradeWindowOpen ? 'Trade Finder' : 'Offseason Planner'}
                    </h2>
                    <p className="text-sm text-text-dim mt-0.5">
                        {isTradeWindowOpen
                            ? 'AI-powered trade partner discovery based on roster needs and surplus.'
                            : 'Analyze potential offseason moves and dynasty stashes.'}
                    </p>
                </div>

                <div className="w-full md:w-64">
                    <select
                        className="w-full bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                        value={selectedRosterId || ''}
                        onChange={(e) => setSelectedRosterId(Number(e.target.value))}
                    >
                        {rosters.map(r => (
                            <option key={r.roster_id} value={r.roster_id}>
                                {displayTeamName(users.find(u => u.user_id === r.owner_id))}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card">
                <div className="flex items-center gap-3 mb-5">
                    {focusOwner?.avatar ? (
                        <img src={avatarUrl(focusOwner.avatar)} alt="" className="w-12 h-12 rounded-full ring-1 ring-line" />
                    ) : (
                        <Pip seed={selectedRosterId ?? 'team'} name={displayTeamName(focusOwner)} size={48} />
                    )}
                    <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold text-text truncate">{displayTeamName(focusOwner)}</h3>
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                            Market Analysis {marketValues ? '· Live Data' : ''}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-bad/10 border border-bad/20 rounded-md p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-3.5 h-3.5 text-bad" />
                            <h4 className="font-mono text-2xs uppercase tracking-wider text-bad">Needs · Weak Starters</h4>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {focusTeam?.needs?.length > 0 ? (
                                focusTeam.needs.map(pos => (
                                    <span key={pos} className="font-mono text-2xs uppercase tracking-wider px-2 py-1 bg-bad/15 text-bad rounded-sm border border-bad/20">
                                        {pos}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-text-mute">No critical needs identified.</span>
                            )}
                        </div>
                    </div>

                    <div className="bg-good/10 border border-good/20 rounded-md p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-3.5 h-3.5 text-good" />
                            <h4 className="font-mono text-2xs uppercase tracking-wider text-good">Surplus · Strong Bench</h4>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {focusTeam?.surplus?.length > 0 ? (
                                focusTeam.surplus.map(s => (
                                    <span key={s.position} className="font-mono text-2xs uppercase tracking-wider px-2 py-1 bg-good/15 text-good rounded-sm border border-good/20">
                                        {s.position}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-text-mute">No significant surplus assets.</span>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <div className="space-y-3">
                <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    Suggested {isTradeWindowOpen ? 'Trade Partners' : 'Offseason Targets'}
                </h3>

                {matches?.length === 0 ? (
                    <div className="text-center py-10 bg-bg-1 rounded-xl border border-line">
                        <User className="w-10 h-10 text-text-mute mx-auto mb-3" />
                        <p className="text-text-dim text-sm">
                            No obvious trade partners found based on current roster construction.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {matches?.map((match, idx) => {
                            const opponentUser = getOwner(match.opponent?.rosterId);
                            const statusTone = STATUS_TONE[match.opponent?.status] || defaultStatusTone;

                            return (
                                <div
                                    key={match.opponent?.rosterId || idx}
                                    className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden hover:border-line-strong transition-colors duration-fast"
                                >
                                    <div className="p-4 border-b border-line flex justify-between items-start gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {opponentUser?.avatar ? (
                                                <img src={avatarUrl(opponentUser.avatar)} alt="" className="w-10 h-10 rounded-full ring-1 ring-line shrink-0" />
                                            ) : (
                                                <Pip seed={match.opponent?.rosterId ?? 'opp'} name={displayTeamName(opponentUser)} size={40} />
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-display font-bold text-text truncate">{displayTeamName(opponentUser)}</h4>
                                                    <span className={`font-mono text-2xs px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-bold border ${statusTone}`}>
                                                        {match.opponent?.status}
                                                    </span>
                                                </div>
                                                <span className={`mt-1 inline-block font-mono text-2xs uppercase tracking-wider px-2 py-0.5 rounded-sm font-semibold ${match.type === 'Perfect Match' ? 'bg-signal/15 text-signal border border-signal/30' : 'bg-bg-3 text-text-dim border border-line'}`}>
                                                    {match.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {match?.dynastySuggestions?.length > 0 && (
                                            <div className="bg-signal-2/10 border border-signal-2/20 rounded-md p-3">
                                                <p className="font-mono text-2xs uppercase tracking-wider text-signal-2 mb-1.5 flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3" /> Dynasty Insight
                                                </p>
                                                {match.dynastySuggestions.map((s, i) => (
                                                    <div key={i}>
                                                        <p className="text-xs text-text-dim mb-1">{s.message}</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {s?.assets?.map(p => (
                                                                <span key={p.id} className="font-mono text-2xs bg-signal-2/15 text-signal-2 px-1.5 py-0.5 rounded-sm">
                                                                    {p.full_name} <span className="tnum">({p.age}yo)</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {isTradeWindowOpen && match?.benchUpgrades?.length > 0 && (
                                            <div className="bg-good/10 border border-good/20 rounded-md p-3">
                                                <p className="font-mono text-2xs uppercase tracking-wider text-good mb-1.5">
                                                    Hidden Gems · Bench Upgrades
                                                </p>
                                                <div className="space-y-1">
                                                    {match.benchUpgrades.map((upgrade, i) => {
                                                        const isRental = upgrade.type === 'Win-Now Rental';
                                                        const isInjured = upgrade.upgradeOver?.injury_status === 'IR' || upgrade.upgradeOver?.injury_status === 'Out';

                                                        return (
                                                            <div key={i} className="text-xs text-text-dim">
                                                                {isRental ? (
                                                                    <span>
                                                                        <span className="text-warn font-semibold">Win-Now Rental:</span> Acquire <span className="font-semibold text-text">{upgrade.player?.full_name}</span> to replace injured {upgrade.upgradeOver?.full_name}
                                                                    </span>
                                                                ) : (
                                                                    <span>
                                                                        Start <span className="font-semibold text-text">{upgrade.player?.full_name}</span> <span className="text-good tnum">(+{upgrade.diff?.toFixed(1)})</span> over {upgrade.upgradeOver?.full_name}
                                                                    </span>
                                                                )}

                                                                {isInjured && (
                                                                    <span className="ml-2 font-mono text-2xs bg-bad/15 text-bad px-1 rounded-sm border border-bad/30">
                                                                        {upgrade.upgradeOver?.injury_status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">Target Assets · You Get</p>
                                            <div className="flex flex-wrap gap-2">
                                                {match?.displayTargets?.length > 0 ? (
                                                    match.displayTargets.map((player, idx) => (
                                                        <div
                                                            key={player.id || idx}
                                                            className={`flex items-center gap-2 bg-bg-2 rounded p-1.5 pr-3 border border-line ${player.isOTB ? 'border-signal/50' : ''}`}
                                                        >
                                                            <span className={`font-mono text-2xs font-bold w-6 ${player.position === 'PICK' ? 'text-signal' : 'text-text-dim'}`}>
                                                                {player.position}
                                                            </span>
                                                            <span className="text-sm text-text">
                                                                {player.full_name || `${player.first_name} ${player.last_name}`}
                                                                {player.isOTB && <span className="ml-1 font-mono text-2xs bg-signal text-ink px-1 rounded-sm font-bold">OTB</span>}
                                                                {player.isDynastyStash && <span className="ml-1 font-mono text-2xs bg-signal-2/15 text-signal-2 border border-signal-2/30 px-1 rounded-sm font-bold">STASH</span>}
                                                            </span>
                                                            <span className="text-xs text-good ml-auto font-mono tnum">
                                                                {(player.tradeValue || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-text-mute italic">Target: Future Draft Capital</div>
                                                )}
                                            </div>
                                        </div>

                                        {match?.giving?.length > 0 && (
                                            <div>
                                                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">Potential Offer · Your Surplus</p>
                                                <div className="space-y-2">
                                                    {match.giving.map((item, i) => (
                                                        <div key={i} className="flex flex-wrap gap-2">
                                                            {item?.assets?.map(player => (
                                                                <div key={player.id} className="flex items-center gap-2 bg-bg-2 rounded p-1.5 pr-3 border border-line">
                                                                    <span className="font-mono text-2xs font-bold text-text-dim w-6">{player.position}</span>
                                                                    <span className="text-sm text-text">{player.full_name || `${player.first_name} ${player.last_name}`}</span>
                                                                    <span className="text-xs text-good ml-auto font-mono tnum">
                                                                        {player.tradeValue?.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {(!match?.giving || match.giving.length === 0) && (
                                            <div className="bg-bg-2 rounded p-3 text-xs text-text-dim italic border border-line">
                                                You don't have a clear surplus in their area of need, but they have players you need. Consider offering picks {isTradeWindowOpen ? 'or starter depth' : 'or stashes'}.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

export default TradeFinder;
