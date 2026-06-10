import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFullTransactionHistory } from '../../../utils/sleeper';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { playerHeadshotUrl, displayTeamName } from '../../../utils/nflData';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Sword, ArrowRightLeft, Skull } from 'lucide-react';

const getStandardPickValue = (round) => {
    if (round === 1) return 5000;
    if (round === 2) return 2000;
    if (round === 3) return 600;
    if (round === 4) return 200;
    return 100;
};

const BiggestFleeces = ({ leagueId, users, players, currentWeek, league, rosters }) => {
    const isSuperflex = league?.roster_positions?.includes('SUPER_FLEX');
    const numTeams = users?.length || 12;

    const { data: trades, isLoading: loadingTrades } = useQuery({
        queryKey: ['fullTradeHistory', leagueId],
        queryFn: () => fetchFullTransactionHistory(leagueId, 3), // look back 3 seasons
        staleTime: 24 * 60 * 60 * 1000, // cache 24h
        enabled: !!leagueId
    });

    const { data: marketValues, isLoading: loadingValues } = useQuery({
        queryKey: ['marketValues', isSuperflex, numTeams],
        queryFn: () => fetchMarketValues(isSuperflex, numTeams, 0.5),
        staleTime: 60 * 60 * 1000,
    });

    const fleeces = useMemo(() => {
        if (!trades || !marketValues || !users || trades.length === 0) return [];

        const evaluatedTrades = trades.map(trade => {
            // Figure out the rosters involved
            const rosterIds = new Set();
            const teamDiffs = {}; // { rosterId: netValueGain }
            const assetsReceived = {}; // { rosterId: [] }
            const assetsGiven = {}; // { rosterId: [] }

            // Init maps
            if (trade.roster_ids) {
                trade.roster_ids.forEach(rid => {
                    rosterIds.add(rid);
                    teamDiffs[rid] = 0;
                    assetsReceived[rid] = [];
                    assetsGiven[rid] = [];
                });
            }

            // Process Adds
            if (trade.adds) {
                Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
                    const val = marketValues[playerId] || 150; // Add baseline value for players
                    const p = players[playerId];
                    teamDiffs[rosterId] = (teamDiffs[rosterId] || 0) + val;
                    assetsReceived[rosterId] = assetsReceived[rosterId] || [];
                    assetsReceived[rosterId].push({ type: 'player', id: playerId, name: p ? `${p.first_name[0]}. ${p.last_name}` : 'Unknown', value: val });
                });
            }

            // Process Drops
            if (trade.drops) {
                Object.entries(trade.drops).forEach(([playerId, rosterId]) => {
                    const val = marketValues[playerId] || 150;
                    const p = players[playerId];
                    teamDiffs[rosterId] = (teamDiffs[rosterId] || 0) - val;
                    assetsGiven[rosterId] = assetsGiven[rosterId] || [];
                    assetsGiven[rosterId].push({ type: 'player', id: playerId, name: p ? `${p.first_name[0]}. ${p.last_name}` : 'Unknown', value: val });
                });
            }

            // Process Picks
            if (trade.draft_picks) {
                trade.draft_picks.forEach(pick => {
                    // Current owner is who traded it away (previous_owner_id or roster_id before the trade)
                    // The trade object in sleeper: 
                    // owner_id (NEW owner)
                    // previous_owner_id (OLD owner)
                    const oldOwnerId = pick.previous_owner_id;
                    const newOwnerId = pick.owner_id;

                    const val = getStandardPickValue(pick.round);
                    const pickName = `${pick.season} Round ${pick.round}`;

                    if (oldOwnerId) {
                        teamDiffs[oldOwnerId] -= val;
                        assetsGiven[oldOwnerId] = assetsGiven[oldOwnerId] || [];
                        assetsGiven[oldOwnerId].push({ type: 'pick', name: pickName, value: val });
                    }
                    if (newOwnerId) {
                        teamDiffs[newOwnerId] += val;
                        assetsReceived[newOwnerId] = assetsReceived[newOwnerId] || [];
                        assetsReceived[newOwnerId].push({ type: 'pick', name: pickName, value: val });
                    }
                });
            }

            // A 2-team trade will have one team positive, one negative. We find the max absolute swing.
            let maxSwing = 0;
            let winnerId = null;
            let loserId = null;

            const rosterKeys = Object.keys(teamDiffs);
            if (rosterKeys.length === 2) {
                const r1 = rosterKeys[0];
                const r2 = rosterKeys[1];
                if (teamDiffs[r1] > teamDiffs[r2]) {
                    winnerId = r1;
                    loserId = r2;
                    maxSwing = teamDiffs[r1];
                } else {
                    winnerId = r2;
                    loserId = r1;
                    maxSwing = teamDiffs[r2];
                }
            } else {
                // Multi-team, just find best and worst
                let maxVal = -Infinity;
                let minVal = Infinity;
                rosterKeys.forEach(r => {
                    if (teamDiffs[r] > maxVal) { maxVal = teamDiffs[r]; winnerId = r; }
                    if (teamDiffs[r] < minVal) { minVal = teamDiffs[r]; loserId = r; }
                });
                maxSwing = maxVal;
            }

            return {
                ...trade,
                netSwing: maxSwing,
                winnerId: parseInt(winnerId),
                loserId: parseInt(loserId),
                assetsReceived,
                assetsGiven
            };
        });

        // Sort descending by highest net swing and take top 10
        return evaluatedTrades
            .filter(t => t.netSwing > 0 && t.winnerId && t.loserId && (t.assetsReceived[t.winnerId]?.length > 0 || t.assetsGiven[t.winnerId]?.length > 0))
            .sort((a, b) => b.netSwing - a.netSwing)
            .slice(0, 5);

    }, [trades, marketValues, players, users]);

    if (loadingTrades || loadingValues) {
        return (
            <Card className="bg-slate-900 border-slate-800 animate-pulse">
                <CardContent className="h-48 flex items-center justify-center">
                    <span className="text-slate-500 font-medium">Scanning league archives...</span>
                </CardContent>
            </Card>
        );
    }

    if (fleeces.length === 0) return null;

    return (
        <Card className="bg-slate-900 border-slate-700 overflow-hidden relative">
            <CardHeader className="bg-slate-800/50 border-b border-slate-700">
                <CardTitle className="flex items-center gap-2 text-white">
                    <Skull className="w-5 h-5 text-red-500" />
                    Biggest Fleeces in League History
                    <span className="ml-2 text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-normal uppercase tracking-wider">
                        Hindsight is 20/20
                    </span>
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                    Ranking past trades using <strong>current</strong> player market values. A reminder that patience (or panic) can permanently alter a franchise.
                </p>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-800/60">
                    {fleeces.map((trade, idx) => {
                        const winner = users.find(u => u.user_id === rosters?.find(r => r.roster_id === trade.winnerId)?.owner_id);
                        const loser = users.find(u => u.user_id === rosters?.find(r => r.roster_id === trade.loserId)?.owner_id);
                        
                        // Fallback safe rendering
                        if (!winner || !loser) return null;

                        return (
                            <div key={trade.transaction_id} className="p-6 relative hover:bg-slate-800/30 transition-colors group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 font-bold text-8xl italic select-none">#{idx + 1}</div>
                                
                                <div className="flex flex-col md:flex-row gap-6 justify-between relative z-10">
                                    
                                    {/* Winner Side */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-3">
                                            {winner.avatar ? (
                                                <img src={`https://sleepercdn.com/avatars/thumbs/${winner.avatar}`} className="w-10 h-10 rounded-full border-2 border-green-500/50" alt="" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-green-500/50" />
                                            )}
                                            <div>
                                                <h4 className="text-green-400 font-black text-lg tracking-tight leading-none">FLEECER</h4>
                                                <span className="text-white text-sm font-medium">{displayTeamName(winner)}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-green-950/20 border border-green-900/30 rounded p-3">
                                            <p className="text-[10px] text-green-500/70 font-bold uppercase tracking-wider mb-2 border-b border-green-900/50 pb-1">Acquired</p>
                                            <div className="space-y-1">
                                                {trade.assetsReceived[trade.winnerId]?.map((asset, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <span className="text-sm text-slate-200 font-medium">{asset.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle VS */}
                                    <div className="flex flex-col items-center justify-center min-w-[120px]">
                                        <div className="bg-red-500/10 rounded-full p-3 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                            <ArrowRightLeft className="w-6 h-6 text-red-400" />
                                        </div>
                                        <div className="mt-3 text-center">
                                            <span className="block text-2xl font-black text-red-500 tracking-tighter">+{trade.netSwing.toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Net Value Swing</span>
                                            <span className="block text-[10px] text-slate-600 mt-1">Week {trade.leg} • {trade.season}</span>
                                        </div>
                                    </div>

                                    {/* Loser Side */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-3 md:flex-row-reverse md:text-right text-left">
                                            {loser.avatar ? (
                                                <img src={`https://sleepercdn.com/avatars/thumbs/${loser.avatar}`} className="w-10 h-10 rounded-full border-2 border-red-500/50" alt="" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-red-500/50" />
                                            )}
                                            <div>
                                                <h4 className="text-red-400 font-black text-lg tracking-tight leading-none">FLEECED</h4>
                                                <span className="text-white text-sm font-medium">{displayTeamName(loser)}</span>
                                            </div>
                                        </div>

                                        <div className="bg-red-950/20 border border-red-900/30 rounded p-3">
                                            <p className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider mb-2 border-b border-red-900/50 pb-1 md:text-right">Acquired</p>
                                            <div className="space-y-1 md:text-right">
                                                {trade.assetsReceived[trade.loserId]?.map((asset, i) => (
                                                    <div key={i} className="flex items-center md:justify-end gap-2">
                                                        <span className="text-sm text-slate-200 font-medium">{asset.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default BiggestFleeces;
