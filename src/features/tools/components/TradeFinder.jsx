import { useMemo } from 'react';
import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';

const TradeFinder = ({ leagueId, currentWeek, rosters, users, players }) => {
    const { seasonMatchups, loading } = useSeasonMatchups(leagueId, currentWeek);
    const playerStats = usePlayerStats(seasonMatchups);

    const userById = useMemo(() => {
        const map = new Map();
        if (users) users.forEach(u => map.set(u.user_id, u));
        return map;
    }, [users]);

    const opportunities = useMemo(() => {
        if (loading || !rosters || !players || Object.keys(playerStats).length === 0) return [];

        const teamAnalysis = {}; // rosterId -> { surplus: [], deficit: [] }

        // 1. Analyze each team
        rosters.forEach(roster => {
            const rosterPlayers = roster.players || [];
            const teamStats = {
                WR: [],
                RB: []
            };

            // Collect stats for all players on roster
            rosterPlayers.forEach(pid => {
                const p = players[pid];
                if (!p) return;
                const stat = playerStats[pid];
                if (!stat) return; // No stats means they haven't started, ignore for "Top 24" calculation

                if (p.position === 'WR') teamStats.WR.push({ ...p, ...stat });
                if (p.position === 'RB') teamStats.RB.push({ ...p, ...stat });
            });

            // Sort by Avg Points
            teamStats.WR.sort((a, b) => b.avgPoints - a.avgPoints);
            teamStats.RB.sort((a, b) => b.avgPoints - a.avgPoints);

            // Identify Surplus (>3 Top 24)
            // We need to know what "Top 24" means globally.
            // Let's calculate global Top 24 thresholds first?
            // Or just use a fixed threshold like > 10 pts/game?
            // "Top 24" implies ranking.
            // Let's rank ALL players first.
        });

        // Rank all players globally
        const allWRs = [];
        const allRBs = [];
        Object.keys(playerStats).forEach(pid => {
            const p = players[pid];
            if (!p) return;
            const stat = playerStats[pid];
            if (p.position === 'WR') allWRs.push({ ...p, ...stat });
            if (p.position === 'RB') allRBs.push({ ...p, ...stat });
        });

        allWRs.sort((a, b) => b.avgPoints - a.avgPoints);
        allRBs.sort((a, b) => b.avgPoints - a.avgPoints);

        const top24WR = new Set(allWRs.slice(0, 24).map(p => p.player_id));
        const top24RB = new Set(allRBs.slice(0, 24).map(p => p.player_id));

        // "Deficit": Starting a player outside Top 40.
        // Top 40 threshold
        const top40WR = new Set(allWRs.slice(0, 40).map(p => p.player_id));
        const top40RB = new Set(allRBs.slice(0, 40).map(p => p.player_id));

        const analysis = [];

        rosters.forEach(roster => {
            const rosterPlayers = roster.players || [];
            const myWRs = [];
            const myRBs = [];

            rosterPlayers.forEach(pid => {
                if (top24WR.has(pid)) myWRs.push(pid);
                if (top24RB.has(pid)) myRBs.push(pid);
            });

            const surplus = [];
            const deficit = [];

            if (myWRs.length > 3) surplus.push('WR');
            if (myRBs.length > 3) surplus.push('RB');

            // Check Deficit (Starters)
            // We need to know who they are STARTING.
            // Use `roster.starters` (current week).
            const starters = roster.starters || [];
            let weakWR = false;
            let weakRB = false;

            starters.forEach(pid => {
                const p = players[pid];
                if (!p) return;
                if (p.position === 'WR' && !top40WR.has(pid)) weakWR = true;
                if (p.position === 'RB' && !top40RB.has(pid)) weakRB = true;
            });

            if (weakWR) deficit.push('WR');
            if (weakRB) deficit.push('RB');

            if (surplus.length > 0 || deficit.length > 0) {
                analysis.push({
                    rosterId: roster.roster_id,
                    ownerId: roster.owner_id,
                    surplus,
                    deficit
                });
            }
        });

        // Matchmaking
        const trades = [];
        analysis.forEach(teamA => {
            teamA.surplus.forEach(pos => {
                // Find teams with deficit in this pos
                analysis.forEach(teamB => {
                    if (teamA.rosterId === teamB.rosterId) return;
                    if (teamB.deficit.includes(pos)) {
                        // Potential Trade
                        trades.push({
                            from: teamA,
                            to: teamB,
                            position: pos
                        });
                    }
                });
            });
        });

        return trades;

    }, [rosters, players, playerStats, loading]);

    if (loading) return <div className="p-4 text-center text-gray-400">Analyzing Rosters...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {opportunities.length > 0 ? (
                opportunities.map((trade, idx) => {
                    const fromOwner = userById.get(trade.from.ownerId);
                    const toOwner = userById.get(trade.to.ownerId);
                    return (
                        <div key={idx} className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <img src={avatarUrl(fromOwner?.avatar)} className="w-8 h-8 rounded-full" />
                                    <span className="text-sm font-medium text-white">{displayTeamName(fromOwner)}</span>
                                </div>
                                <span className="text-xs text-gray-400">should send</span>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                                <span className="text-lg font-bold text-blue-400">{trade.position}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">to</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white">{displayTeamName(toOwner)}</span>
                                    <img src={avatarUrl(toOwner?.avatar)} className="w-8 h-8 rounded-full" />
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="col-span-full text-center text-gray-400 py-8">
                    No obvious trade opportunities found based on surplus/deficit logic.
                </div>
            )}
        </div>
    );
};

export default TradeFinder;
