import { useState, useMemo } from 'react';
import { useTradeAnalysis } from '../hooks/useTradeAnalysis';
import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { RefreshCw, TrendingUp, TrendingDown, ArrowRightLeft, User } from 'lucide-react';

const TradeFinder = ({ leagueId, currentWeek, rosters, users, players, league }) => {
    const { seasonMatchups, loading: matchupsLoading } = useSeasonMatchups(leagueId, currentWeek);
    const { teamAnalysis, findMatches, playerValues } = useTradeAnalysis(league, rosters, players, seasonMatchups, currentWeek);

    // Default to current user if possible, else first roster
    const [selectedRosterId, setSelectedRosterId] = useState(null);

    // Initialize selected roster once data is loaded
    useMemo(() => {
        if (!selectedRosterId && rosters && rosters.length > 0) {
            // Try to find logged in user? For now just pick first
            setSelectedRosterId(rosters[0].roster_id);
        }
    }, [rosters, selectedRosterId]);

    const focusTeam = teamAnalysis[selectedRosterId];
    const matches = useMemo(() => findMatches(selectedRosterId), [selectedRosterId, findMatches]);

    if (matchupsLoading || !focusTeam) {
        return <div className="p-8 text-center text-gray-400">Analyzing League Market...</div>;
    }

    const getOwner = (rosterId) => users.find(u => u.user_id === rosters.find(r => r.roster_id === rosterId)?.owner_id);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ArrowRightLeft className="w-6 h-6 text-blue-400" />
                        Trade Finder
                    </h2>
                    <p className="text-sm text-slate-400">AI-powered trade partner discovery based on roster needs and surplus.</p>
                </div>

                <div className="w-full md:w-64">
                    <select
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
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

            {/* Team Health Card */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                <div className="flex items-center gap-4 mb-6">
                    <img
                        src={avatarUrl(getOwner(selectedRosterId)?.avatar)}
                        alt=""
                        className="w-12 h-12 rounded-full border-2 border-slate-600"
                    />
                    <div>
                        <h3 className="text-lg font-bold text-white">{displayTeamName(getOwner(selectedRosterId))}</h3>
                        <p className="text-xs text-slate-400">Market Analysis</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-4 h-4 text-red-400" />
                            <h4 className="text-sm font-semibold text-red-400">Needs (Weak Starters)</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {focusTeam.needs.length > 0 ? (
                                focusTeam.needs.map(pos => (
                                    <span key={pos} className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded font-medium">
                                        {pos}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-slate-500">No critical needs identified.</span>
                            )}
                        </div>
                    </div>

                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <h4 className="text-sm font-semibold text-green-400">Surplus (Strong Bench)</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {focusTeam.surplus.length > 0 ? (
                                focusTeam.surplus.map(s => (
                                    <span key={s.position} className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded font-medium">
                                        {s.position}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-slate-500">No significant surplus assets.</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Matches List */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Suggested Trade Partners</h3>

                {matches.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No obvious trade partners found based on current roster construction.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {matches.map((match, idx) => {
                            const opponentUser = getOwner(match.opponent.rosterId);
                            const statusColor = match.opponent.status === 'Contender' ? 'text-green-400 bg-green-400/10' :
                                match.opponent.status === 'Rebuilder' ? 'text-orange-400 bg-orange-400/10' : 'text-slate-400 bg-slate-400/10';

                            return (
                                <div key={match.opponent.rosterId} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors">
                                    <div className="p-4 border-b border-slate-700 flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={avatarUrl(opponentUser?.avatar)}
                                                alt=""
                                                className="w-10 h-10 rounded-full"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-white">{displayTeamName(opponentUser)}</h4>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${statusColor}`}>
                                                        {match.opponent.status}
                                                    </span>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${match.type === 'Perfect Match' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                    {match.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {/* Dynasty Insights */}
                                        {match.dynastySuggestions && match.dynastySuggestions.length > 0 && (
                                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                                                <p className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3" /> Dynasty Insight
                                                </p>
                                                {match.dynastySuggestions.map((s, i) => (
                                                    <div key={i}>
                                                        <p className="text-xs text-indigo-200 mb-1">{s.message}</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {s.assets.map(p => (
                                                                <span key={p.id} className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                                                                    {p.full_name} ({p.age}yo)
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Bench Upgrades (Hidden Gems) */}
                                        {match.benchUpgrades && match.benchUpgrades.length > 0 && (
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                                <p className="text-xs font-bold text-emerald-300 mb-2 flex items-center gap-1">
                                                    💎 Hidden Gems (Bench Upgrades)
                                                </p>
                                                <div className="space-y-1">
                                                    {match.benchUpgrades.map((upgrade, i) => {
                                                        const isRental = upgrade.type === 'Win-Now Rental';
                                                        const isInjured = upgrade.upgradeOver.injury_status === 'IR' || upgrade.upgradeOver.injury_status === 'Out';

                                                        return (
                                                            <div key={i} className="text-xs text-emerald-100">
                                                                {isRental ? (
                                                                    <span>
                                                                        <span className="text-orange-300 font-bold">Win-Now Rental:</span> Acquire <span className="font-bold text-white">{upgrade.player.full_name}</span> to replace injured {upgrade.upgradeOver.full_name}
                                                                    </span>
                                                                ) : (
                                                                    <span>
                                                                        Start <span className="font-bold text-white">{upgrade.player.full_name}</span> <span className="text-emerald-400">(+{upgrade.diff.toFixed(1)})</span> over {upgrade.upgradeOver.full_name}
                                                                    </span>
                                                                )}

                                                                {isInjured && (
                                                                    <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1 rounded border border-red-500/30">
                                                                        {upgrade.upgradeOver.injury_status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* They Have (Target) */}
                                        {match.receiving.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Target Assets (Their Surplus)</p>
                                                <div className="space-y-2">
                                                    {match.receiving.map(item => (
                                                        <div key={item.position} className="flex flex-wrap gap-2">
                                                            {item.assets.map(player => (
                                                                <div key={player.id} className={`flex items-center gap-2 bg-slate-700/50 rounded p-1.5 pr-3 ${player.isOTB ? 'border border-yellow-500/50' : ''}`}>
                                                                    <span className="text-xs font-bold text-slate-300 w-6">{player.position}</span>
                                                                    <span className="text-sm text-white">
                                                                        {player.full_name || player.first_name + ' ' + player.last_name}
                                                                        {player.isOTB && <span className="ml-1 text-[10px] bg-yellow-500 text-black px-1 rounded font-bold">OTB</span>}
                                                                    </span>
                                                                    <span className="text-xs text-green-400 ml-auto">{player.value.toFixed(1)} ppg</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* You Have (Offer) */}
                                        {match.giving.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Potential Offer (Your Surplus)</p>
                                                <div className="space-y-2">
                                                    {match.giving.map(item => (
                                                        <div key={item.position} className="flex flex-wrap gap-2">
                                                            {item.assets.map(player => (
                                                                <div key={player.id} className="flex items-center gap-2 bg-slate-700/50 rounded p-1.5 pr-3">
                                                                    <span className="text-xs font-bold text-slate-300 w-6">{player.position}</span>
                                                                    <span className="text-sm text-white">{player.full_name || player.first_name + ' ' + player.last_name}</span>
                                                                    <span className="text-xs text-green-400 ml-auto">{player.value.toFixed(1)} ppg</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {match.giving.length === 0 && (
                                            <div className="bg-slate-700/20 rounded p-3 text-xs text-slate-400 italic">
                                                You don't have a clear surplus in their area of need, but they have players you need. Consider offering picks or starters depth.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradeFinder;
