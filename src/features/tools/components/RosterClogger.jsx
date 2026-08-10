import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchSeasonStats, getRookieLockState } from '../../../utils/sleeper';
import { playerHeadshotUrl } from '../../../utils/nflData';
import { Loader2, AlertTriangle, TrendingUp, ShieldCheck, Skull } from 'lucide-react';

const PlayerInfo = ({ player, ppg }) => {
    if (!player) return <div className="text-text-mute text-xs italic">No clear upgrade found</div>;

    return (
        <div className="flex items-center gap-3 p-2 rounded bg-bg-2 border border-line">
            <img
                src={playerHeadshotUrl(player.player_id)}
                alt={player.last_name}
                className="w-10 h-10 rounded-full bg-bg-3 object-cover ring-1 ring-line"
                onError={(e) => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
            />
            <div className="min-w-0">
                <div className="font-semibold text-sm text-text leading-none mb-1 truncate">
                    {player.first_name} {player.last_name}
                </div>
                <div className="font-mono text-2xs text-text-mute flex gap-2 items-center uppercase tracking-wider">
                    <span className="px-1 border border-line rounded-sm">{player.position}</span>
                    <span>Age <span className="tnum">{player.age}</span></span>
                    {ppg !== undefined && <span className={`tnum ${ppg > 0 ? 'text-good' : 'text-text-mute'}`}>{ppg.toFixed(1)} PPG</span>}
                </div>
            </div>
        </div>
    );
};

const RosterClogger = ({ rosters, players, league, drafts }) => {
    const { user } = useSleeper();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const { rookiesLocked, nextDraftStartTime, label: lockLabel } = useMemo(
        () => getRookieLockState(league, drafts),
        [league, drafts]
    );

    useEffect(() => {
        const loadStats = async () => {
            const season = league?.season || String(new Date().getFullYear());
            setLoading(true);
            try {
                let data = await fetchSeasonStats(season);
                const hasData = data && Object.values(data).some(s => s?.gp > 0);
                if (!hasData) {
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

    const cloggerAnalysis = useMemo(() => {
        if (!rosters || !players || !stats || !user || !league) return [];

        const userRoster = rosters.find(r => r.owner_id === user.user_id);
        if (!userRoster) return [];

        const benchIds = (userRoster.players || []).filter(id => !userRoster.starters.includes(id));

        const allRosteredIds = new Set();
        rosters.forEach(r => {
            (r.players || []).forEach(id => allRosteredIds.add(id));
        });

        const freeAgents = Object.values(players)
            .filter(p =>
                !allRosteredIds.has(p.player_id) &&
                p.search_rank != null && p.search_rank < 1000 &&
                ['QB', 'RB', 'WR', 'TE'].includes(p.position) &&
                p.team &&
                (p.status === 'Active' || !p.status) &&
                // Rookies (years_exp = 0 / null pre-draft prospects) are locked
                // until the league's rookie draft completes.
                (!rookiesLocked || (p.years_exp != null && p.years_exp > 0))
            )
            .sort((a, b) => (a.search_rank || 9999) - (b.search_rank || 9999))
            .slice(0, 50);

        const results = [];
        const usedUpgradeIds = new Set();

        benchIds.forEach(playerId => {
            const player = players[playerId];
            if (!player) return;
            const pStats = stats[playerId];
            const ppg = pStats?.pts_ppr && pStats?.gp ? (pStats.pts_ppr / pStats.gp) : 0;
            const rank = player.search_rank || 9999;
            const age = player.age || 0;
            const exp = player.years_exp || 0;

            if (age < 24 || exp < 2) return;
            if (rank < 300) return;

            const isSuperflex = league.settings?.type === 2 || league.roster_positions?.includes('SUPER_FLEX');
            if (player.position === 'QB' && isSuperflex) return;

            let reason = null;
            let severity = 'medium';

            const isActive = player.status === 'Active' || !player.status;
            if (!isActive) {
                if ((['RB', 'WR', 'TE'].includes(player.position) && ppg > 8.0) || (player.position === 'QB' && ppg > 12.0)) return;
                if (ppg < 5.0 && rank > 500) {
                    reason = "Low Value IR Stash";
                    severity = 'high';
                } else {
                    return;
                }
            }

            if (!reason) {
                if (age > 26 && ppg < 6.5) {
                    reason = "Low Ceiling Veteran";
                    severity = 'medium';
                } else if (player.position === 'RB' && age > 25 && ppg < 5.0) {
                    reason = "Replaceable RB Production";
                    severity = 'high';
                } else if (rank > 700) {
                    reason = "Zero Market Value";
                    severity = 'low';
                }
            }

            if (reason) {
                const upgrade = freeAgents.find(fa => {
                    if (usedUpgradeIds.has(fa.player_id)) return false;
                    if (fa.position !== player.position) return false;
                    const faStats = stats[fa.player_id];
                    const faPpg = faStats?.pts_ppr && faStats?.gp ? (faStats.pts_ppr / faStats.gp) : 0;
                    if (fa.age < 24 && fa.search_rank < rank) return true;
                    if (faPpg > ppg + 1.0) return true;
                    return false;
                });

                if (upgrade) usedUpgradeIds.add(upgrade.player_id);

                results.push({ player, ppg, reason, severity, upgrade });
            }
        });

        return results.sort((a, b) => (a.player.search_rank || 9999) - (b.player.search_rank || 9999));
    }, [rosters, players, stats, user, league, rookiesLocked]);

    if (loading) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line p-6 shadow-card flex items-center justify-center h-[180px]">
                <Loader2 className="w-5 h-5 text-signal animate-spin mr-2" />
                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    Analyzing roster efficiency…
                </span>
            </section>
        );
    }

    if (cloggerAnalysis.length === 0) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden border-l-4 border-l-good">
                <header className="p-4">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-good" aria-hidden="true" />
                        Tool · Roster Clogger
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-text">Roster Optimized</h3>
                </header>
                <div className="px-4 pb-4">
                    <p className="text-sm text-text-dim">
                        No obvious "Cloggers" detected on your bench. Your depth players all have youth, value, or production upside.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                    <Skull className="w-3 h-3 text-bad" aria-hidden="true" />
                    Tool · Roster Clogger
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold text-text">Bench Drop Candidates</h3>
                <p className="text-xs text-text-dim mt-1">Identifying low-upside bench players you can safely drop.</p>
            </header>

            {rookiesLocked && (
                <div className="mx-4 mt-4 flex items-start gap-2 p-3 rounded-md bg-warn/10 border border-warn/30 text-warn">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="text-xs">
                        <span className="font-mono text-2xs uppercase tracking-wider font-bold mr-2">{lockLabel}</span>
                        <span className="text-text">
                            Rookies are not yet available to add
                            {nextDraftStartTime
                                ? ` — your league's rookie draft is scheduled for ${new Date(nextDraftStartTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.`
                                : '.'}
                        </span>
                    </div>
                </div>
            )}

            <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cloggerAnalysis.map((item, idx) => (
                        <div key={idx} className="bg-bg rounded-md border border-line overflow-hidden flex flex-col">
                            <div className="bg-bad/10 p-3 border-b border-bad/20">
                                <div className="font-mono text-2xs uppercase tracking-wider text-bad mb-1.5">Cut Candidate</div>
                                <PlayerInfo player={item.player} ppg={item.ppg} />
                            </div>

                            <div className="px-3 py-2 bg-bg-2/40 flex items-center gap-2 text-xs text-bad border-b border-line">
                                <AlertTriangle className="w-3 h-3" />
                                {item.reason}
                            </div>

                            <div className="p-3 bg-good/5 flex-1 flex flex-col justify-center">
                                <div className="font-mono text-2xs uppercase tracking-wider text-good mb-1.5 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    Waiver Target
                                </div>
                                <PlayerInfo
                                    player={item.upgrade}
                                    ppg={stats && item.upgrade && stats[item.upgrade.player_id]?.gp
                                        ? (stats[item.upgrade.player_id].pts_ppr / stats[item.upgrade.player_id].gp)
                                        : 0}
                                />
                                {!item.upgrade && (
                                    <span className="text-xs text-text-mute mt-1 italic">No clear upgrade on waivers.</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default RosterClogger;
