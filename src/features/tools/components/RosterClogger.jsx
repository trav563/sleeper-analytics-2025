import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchSeasonStats } from '../../../utils/sleeper';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { displayTeamName, playerHeadshotUrl } from '../../../utils/nflData';
import { Loader2, AlertTriangle, TrendingUp, ShieldCheck, Skull } from 'lucide-react';

const RosterClogger = ({ rosters, players, league, state }) => {
    const { user } = useSleeper();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState([]);

    // 1. Fetch Season Stats for PPG/Production (fall back to previous season if current has no data)
    useEffect(() => {
        const loadStats = async () => {
            const season = league?.season || '2025';
            try {
                let data = await fetchSeasonStats(season);
                // Check if current season has meaningful data
                const hasData = data && Object.values(data).some(s => s?.gp > 0);
                if (!hasData) {
                    // Fall back to previous season
                    const prevSeason = String(parseInt(season) - 1);
                    data = await fetchSeasonStats(prevSeason);
                }
                setStats(data);
            } catch (e) {
                console.error("Failed to fetch season stats", e);
            } finally {
                setLoading(false);
            }
        };
        if (league) loadStats();
    }, [league]);

    // 2. The Core Logic
    const cloggerAnalysis = useMemo(() => {
        if (!rosters || !players || !stats || !user || !league) return [];

        // Find user roster
        const userRoster = rosters.find(r => r.owner_id === user.user_id);
        if (!userRoster) return [];

        const benchIds = (userRoster.players || []).filter(id => !userRoster.starters.includes(id));

        // Find All Rostered Players (to determine Free Agents)
        const allRosteredIds = new Set();
        rosters.forEach(r => {
            (r.players || []).forEach(id => allRosteredIds.add(id));
        });

        // Prepare Free Agents (Top 50 available by search_rank)
        // Optimization: Don't iterate ALL players. Just iterate ones with stats or reasonable rank? 
        // Actually, 'players' is huge. We need to be efficient.
        // Let's filter players who are NOT in allRosteredIds AND have a search_rank < 1000.
        const freeAgents = Object.values(players)
            .filter(p =>
                !allRosteredIds.has(p.player_id) &&
                p.search_rank < 1000 &&
                ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
                p.team && // Must be on an NFL team
                (p.status === 'Active' || !p.status) // Must be active (not suspended/imprisoned)
            )
            .sort((a, b) => (a.search_rank || 9999) - (b.search_rank || 9999))
            .slice(0, 50);

        const results = [];
        const usedUpgradeIds = new Set(); // Track suggested FAs to prevent duplicates

        benchIds.forEach(playerId => {
            const player = players[playerId];
            if (!player) return; // Unknown player
            const pStats = stats[playerId];
            const ppg = pStats?.pts_ppr && pStats?.gp ? (pStats.pts_ppr / pStats.gp) : 0;
            const rank = player.search_rank || 9999;
            const age = player.age || 0;
            const exp = player.years_exp || 0;

            // --- PHASE 1: SHIELDS (Automatic Keeps) ---

            // Youth Shield
            if (age < 24 || exp < 2) return;

            // Crowd Wisdom Shield (Rank < 300 ~ top 25 rounds)
            if (rank < 300) return;

            // Format Shield (Superflex QB)
            const isSuperflex = league.settings?.type === 2 || league.roster_positions?.includes('SUPER_FLEX');
            if (player.position === 'QB' && isSuperflex) return;


            // --- PHASE 2: INJURY CONTEXT ---

            let reason = null;
            let severity = 'medium'; // low, medium, high (clogger level)

            const isActive = player.status === 'Active' || !player.status; // Sleeper sometimes null for active
            if (!isActive) {
                // Star Shield for IR
                if ((['RB', 'WR', 'TE'].includes(player.position) && ppg > 8.0) || (player.position === 'QB' && ppg > 12.0)) {
                    return; // Keep productive IR players
                }
                // Dead Weight IR
                if (ppg < 5.0 && rank > 500) {
                    reason = "Low Value IR Stash";
                    severity = 'high';
                } else {
                    return; // Injured but borderline, give benefit of doubt
                }
            }

            // --- PHASE 3: ACTIVE CLOGGER ---

            if (!reason) { // Only check if not already flagged as IR Clogger
                // The Useless Vet
                if (age > 26 && ppg < 6.5) {
                    reason = "Low Ceiling Veteran";
                    severity = 'medium';
                }
                // The Dead Zone RB
                else if (player.position === 'RB' && age > 25 && ppg < 5.0) {
                    reason = "Replaceable RB Production";
                    severity = 'high';
                }
                // The Hoarder (just a catch all for very low rank)
                else if (rank > 700) {
                    reason = "Zero Market Value";
                    severity = 'low';
                }
            }

            if (reason) {
                // Find Upgrade (exclude already-suggested FAs)
                const upgrade = freeAgents.find(fa => {
                    if (usedUpgradeIds.has(fa.player_id)) return false;
                    if (fa.position !== player.position) return false;
                    const faStats = stats[fa.player_id];
                    const faPpg = faStats?.pts_ppr && faStats?.gp ? (faStats.pts_ppr / faStats.gp) : 0;

                    // Better Prospect?
                    if (fa.age < 24 && fa.search_rank < rank) return true;
                    // Better Production?
                    if (faPpg > ppg + 1.0) return true;

                    return false;
                });

                if (upgrade) usedUpgradeIds.add(upgrade.player_id);

                results.push({
                    player,
                    ppg,
                    reason,
                    severity,
                    upgrade
                });
            }
        });

        return results.sort((a, b) => (a.player.search_rank || 9999) - (b.player.search_rank || 9999));

    }, [rosters, players, stats, user, league]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 bg-slate-800/50 rounded-xl border border-slate-700 h-[200px]">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-2" />
                <span className="text-slate-400">Analyzing Roster Efficiency...</span>
            </div>
        );
    }

    if (!candidates && cloggerAnalysis.length === 0) {
        return (
            <Card className="bg-slate-800/50 border-slate-700 mb-8 border-l-4 border-l-green-500">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-400">
                        <ShieldCheck className="w-6 h-6" />
                        Roster Optimized
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400">No obvious "Cloggers" detected on your bench. Your depth players all have youth, value, or production upside.</p>
                </CardContent>
            </Card>
        );
    }

    // Helper for rendering player mini-card
    const PlayerInfo = ({ player, ppg, label, color }) => {
        if (!player) return <div className="text-slate-500 text-xs italic">No clear upgrade found</div>;

        return (
            <div className={`flex items-center gap-3 p-2 rounded bg-slate-900/50 border border-slate-800 ${color ? 'border-l-2 ' + color : ''}`}>
                <img
                    src={playerHeadshotUrl(player.player_id)}
                    alt={player.last_name}
                    className="w-10 h-10 rounded-full bg-slate-800 object-cover"
                    onError={(e) => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
                />
                <div>
                    <div className="font-bold text-sm text-white leading-none mb-1">{player.first_name} {player.last_name}</div>
                    <div className="text-[10px] text-slate-400 flex gap-2">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{player.position}</Badge>
                        <span>Age {player.age}</span>
                        {ppg !== undefined && <span className={ppg > 0 ? "text-green-400" : ""}>{ppg.toFixed(1)} PPG</span>}
                    </div>
                </div>
            </div>
        )
    };

    return (
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <Skull className="w-5 h-5 text-red-500" />
                    Roster Clogger Detector
                </CardTitle>
                <p className="text-xs text-slate-400">Identifying low-upside bench players you can safely drop.</p>
            </CardHeader>
            <CardContent>
                {cloggerAnalysis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                        <ShieldCheck className="w-12 h-12 text-green-500 mb-2" />
                        <h3 className="text-lg font-bold text-white">Clean Bill of Health</h3>
                        <p className="text-slate-400 max-w-md">No "cloggers" found. Your bench consists entirely of young prospects, high-value assets, or productive veterans.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {cloggerAnalysis.map((item, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-700 rounded-lg p-0 overflow-hidden flex flex-col">
                                {/* Clogger Header */}
                                <div className="bg-red-500/10 p-3 border-b border-red-500/20 flex justify-between items-start">
                                    <div>
                                        <div className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">CUT CANDIDATE</div>
                                        <PlayerInfo player={item.player} ppg={item.ppg} />
                                    </div>
                                </div>

                                {/* Reason */}
                                <div className="px-3 py-2 bg-slate-950/30 flex items-center gap-2 text-xs text-red-300 border-b border-slate-800">
                                    <AlertTriangle className="w-3 h-3" />
                                    {item.reason}
                                </div>

                                {/* Upgrade Suggestion */}
                                <div className="p-3 bg-green-500/5 flex-1 flex flex-col justify-center">
                                    <div className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        WAIVER TARGET
                                    </div>
                                    <PlayerInfo
                                        player={item.upgrade}
                                        ppg={stats && item.upgrade && stats[item.upgrade.player_id]?.gp
                                            ? (stats[item.upgrade.player_id].pts_ppr / stats[item.upgrade.player_id].gp)
                                            : 0}
                                        color="border-l-green-500"
                                    />
                                    {!item.upgrade && <span className="text-xs text-slate-500 mt-1">No clear upgrade on waivers.</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default RosterClogger;
