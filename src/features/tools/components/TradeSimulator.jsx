import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ArrowLeftRight, Check, RotateCcw } from 'lucide-react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchSleeper } from '../../../utils/sleeper';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const TradeSimulator = ({ league, rosters, users, players, currentWeek }) => {
    const { user } = useSleeper();

    // Fetch last season stats for PPG-based values
    const leagueSeason = league?.season || '2025';
    const prevSeason = String(Number(leagueSeason) - 1);

    const { data: seasonStats } = useQuery({
        queryKey: ['seasonStats', prevSeason],
        queryFn: () => fetchSleeper(`/stats/nfl/regular/${prevSeason}`),
        staleTime: 60 * 60 * 1000,
        enabled: !!league,
    });

    // Determine PPR field
    const pprField = useMemo(() => {
        const rec = league?.scoring_settings?.rec ?? 0;
        if (rec >= 1) return 'pts_ppr';
        if (rec >= 0.5) return 'pts_half_ppr';
        return 'pts_std';
    }, [league]);

    // Team selection
    const [team1Id, setTeam1Id] = useState(null);
    const [team2Id, setTeam2Id] = useState(null);
    const [team1Selected, setTeam1Selected] = useState(new Set());
    const [team2Selected, setTeam2Selected] = useState(new Set());

    // Default to logged-in user
    useEffect(() => {
        if (!rosters || !rosters.length || team1Id) return;
        if (user) {
            const myRoster = rosters.find(r => r.owner_id === user.user_id);
            if (myRoster) {
                setTeam1Id(myRoster.roster_id);
                const other = rosters.find(r => r.roster_id !== myRoster.roster_id);
                if (other) setTeam2Id(other.roster_id);
            }
        } else if (rosters.length >= 2) {
            setTeam1Id(rosters[0].roster_id);
            setTeam2Id(rosters[1].roster_id);
        }
    }, [rosters, user, team1Id]);

    const roster1 = rosters?.find(r => r.roster_id === team1Id);
    const roster2 = rosters?.find(r => r.roster_id === team2Id);
    const owner1 = users?.find(u => u.user_id === roster1?.owner_id);
    const owner2 = users?.find(u => u.user_id === roster2?.owner_id);

    // Build player list with PPG from last season
    const getPlayerList = (roster) => {
        if (!roster || !players) return [];
        return (roster.players || [])
            .map(pid => {
                const p = players[pid];
                if (!p || !['QB', 'RB', 'WR', 'TE'].includes(p.position)) return null;
                const stats = seasonStats?.[pid];
                const gp = stats?.gp || 0;
                const pts = stats?.[pprField] ?? stats?.pts_ppr ?? 0;
                const ppg = gp > 0 ? parseFloat((pts / gp).toFixed(1)) : 0;

                return {
                    pid,
                    name: `${p.first_name} ${p.last_name}`,
                    pos: p.position,
                    team: p.team || 'FA',
                    age: p.age || '?',
                    ppg,
                    gp,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.ppg - a.ppg);
    };

    const team1Players = useMemo(() => getPlayerList(roster1), [roster1, players, seasonStats, pprField]);
    const team2Players = useMemo(() => getPlayerList(roster2), [roster2, players, seasonStats, pprField]);

    const togglePlayer = (side, pid) => {
        const [selected, setSelected] = side === 1 ? [team1Selected, setTeam1Selected] : [team2Selected, setTeam2Selected];
        const next = new Set(selected);
        if (next.has(pid)) next.delete(pid);
        else next.add(pid);
        setSelected(next);
    };

    const reset = () => {
        setTeam1Selected(new Set());
        setTeam2Selected(new Set());
    };

    // PPG totals for selected players
    const team1PPG = useMemo(() => {
        return [...team1Selected].reduce((sum, pid) => {
            const p = team1Players.find(pl => pl.pid === pid);
            return sum + (p?.ppg || 0);
        }, 0);
    }, [team1Selected, team1Players]);

    const team2PPG = useMemo(() => {
        return [...team2Selected].reduce((sum, pid) => {
            const p = team2Players.find(pl => pl.pid === pid);
            return sum + (p?.ppg || 0);
        }, 0);
    }, [team2Selected, team2Players]);

    const ppgDiff = Math.abs(team1PPG - team2PPG);
    const maxPPG = Math.max(team1PPG, team2PPG) || 1;
    const fairnessRatio = ppgDiff / maxPPG;
    const fairnessColor = fairnessRatio <= 0.15 ? 'text-green-400' : fairnessRatio <= 0.3 ? 'text-yellow-400' : 'text-red-400';
    const fairnessLabel = fairnessRatio <= 0.15 ? 'Fair Trade' : fairnessRatio <= 0.3 ? 'Slight Edge' : 'Lopsided';

    // Positional PPG comparison (radar chart based on roster PPG by position)
    const radarData = useMemo(() => {
        if (!team1Players.length || !team2Players.length) return [];

        const calcPosAvg = (playerList) => {
            const result = {};
            ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
                const posPlayers = playerList.filter(p => p.pos === pos && p.ppg > 0);
                result[pos] = posPlayers.length > 0
                    ? parseFloat((posPlayers.reduce((s, p) => s + p.ppg, 0) / Math.min(posPlayers.length, 3)).toFixed(1))
                    : 0;
            });
            return result;
        };

        const t1Avg = calcPosAvg(team1Players);
        const t2Avg = calcPosAvg(team2Players);
        const name1 = displayTeamName(owner1);
        const name2 = displayTeamName(owner2);

        return ['QB', 'RB', 'WR', 'TE'].map(pos => ({
            subject: pos,
            [name1]: t1Avg[pos],
            [name2]: t2Avg[pos],
            fullMark: 25,
        }));
    }, [team1Players, team2Players, owner1, owner2]);

    const hasSelections = team1Selected.size > 0 || team2Selected.size > 0;
    const hasStats = seasonStats && Object.keys(seasonStats).length > 0;

    if (!rosters || rosters.length < 2) return null;

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5 text-blue-400" />
                        <CardTitle className="text-lg font-semibold text-white">Trade Simulator</CardTitle>
                    </div>
                    {hasSelections && (
                        <Button onClick={reset} variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                            <RotateCcw className="w-4 h-4 mr-1" /> Reset
                        </Button>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                    Select players from each team to simulate a trade
                    {hasStats && <span className="text-slate-500"> — Values based on {prevSeason} season PPG</span>}
                </p>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
                {/* Team Selectors */}
                <div className="grid grid-cols-2 gap-4">
                    <select
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg p-2.5"
                        value={team1Id || ''}
                        onChange={(e) => { setTeam1Id(Number(e.target.value)); setTeam1Selected(new Set()); }}
                    >
                        {rosters.map(r => {
                            const o = users?.find(u => u.user_id === r.owner_id);
                            return <option key={r.roster_id} value={r.roster_id}>{displayTeamName(o)}</option>;
                        })}
                    </select>
                    <select
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg p-2.5"
                        value={team2Id || ''}
                        onChange={(e) => { setTeam2Id(Number(e.target.value)); setTeam2Selected(new Set()); }}
                    >
                        {rosters.filter(r => r.roster_id !== team1Id).map(r => {
                            const o = users?.find(u => u.user_id === r.owner_id);
                            return <option key={r.roster_id} value={r.roster_id}>{displayTeamName(o)}</option>;
                        })}
                    </select>
                </div>

                {/* Player Lists */}
                <div className="grid grid-cols-2 gap-4">
                    {[{ players: team1Players, selected: team1Selected, side: 1, owner: owner1, color: 'red' },
                      { players: team2Players, selected: team2Selected, side: 2, owner: owner2, color: 'green' }
                    ].map(({ players: pList, selected, side, owner, color }) => (
                        <div key={side} className="space-y-1 max-h-72 overflow-y-auto pr-1">
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                                {displayTeamName(owner)} sends:
                            </p>
                            {pList.map(p => (
                                <button
                                    key={p.pid}
                                    onClick={() => togglePlayer(side, p.pid)}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                                        selected.has(p.pid)
                                            ? `bg-${color}-500/20 border border-${color}-500/40 text-${color}-300`
                                            : 'bg-slate-700/30 hover:bg-slate-700/60 text-slate-300'
                                    }`}
                                    style={selected.has(p.pid) ? {
                                        backgroundColor: color === 'red' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                        borderColor: color === 'red' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)',
                                        color: color === 'red' ? '#fca5a5' : '#86efac',
                                    } : {}}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-500 w-6">{p.pos}</span>
                                        <span className="truncate max-w-[100px]">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {p.ppg > 0 && <span className="text-[10px] font-mono text-slate-500">{p.ppg} PPG</span>}
                                        {selected.has(p.pid) && <Check className="w-3 h-3" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Trade Results — always visible when players selected */}
                {hasSelections && (
                    <div className="space-y-4 pt-2 border-t border-slate-700">
                        {/* PPG Comparison */}
                        <div className="bg-slate-900/50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-slate-400">Combined PPG Comparison</span>
                                {team1Selected.size > 0 && team2Selected.size > 0 && (
                                    <span className={`text-xs font-bold ${fairnessColor}`}>{fairnessLabel}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right flex-1">
                                    <div className="text-sm font-mono text-red-400">{team1PPG.toFixed(1)} PPG</div>
                                    <div className="text-[10px] text-slate-500">{displayTeamName(owner1)} sends</div>
                                </div>
                                <div className="w-px h-8 bg-slate-700" />
                                <div className="flex-1">
                                    <div className="text-sm font-mono text-green-400">{team2PPG.toFixed(1)} PPG</div>
                                    <div className="text-[10px] text-slate-500">{displayTeamName(owner2)} sends</div>
                                </div>
                            </div>
                        </div>

                        {/* Positional Radar */}
                        {radarData.length > 0 && (
                            <div className="bg-slate-900/50 rounded-lg p-4">
                                <p className="text-xs text-slate-400 mb-2">Positional Strength ({prevSeason} PPG)</p>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={radarData}>
                                            <PolarGrid stroke="#475569" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                                            <Radar name={displayTeamName(owner1)} dataKey={displayTeamName(owner1)} stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                                            <Radar name={displayTeamName(owner2)} dataKey={displayTeamName(owner2)} stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                                            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 10 }} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Selected Players Summary */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <p className="text-red-400 font-medium mb-1">{displayTeamName(owner1)} sends:</p>
                                {[...team1Selected].map(pid => {
                                    const p = team1Players.find(pl => pl.pid === pid);
                                    return p ? (
                                        <div key={pid} className="flex justify-between text-slate-400">
                                            <span>{p.pos}: {p.name}</span>
                                            <span className="font-mono text-slate-500">{p.ppg} PPG</span>
                                        </div>
                                    ) : null;
                                })}
                                {team1Selected.size === 0 && <div className="text-slate-600 italic">No players selected</div>}
                            </div>
                            <div>
                                <p className="text-green-400 font-medium mb-1">{displayTeamName(owner2)} sends:</p>
                                {[...team2Selected].map(pid => {
                                    const p = team2Players.find(pl => pl.pid === pid);
                                    return p ? (
                                        <div key={pid} className="flex justify-between text-slate-400">
                                            <span>{p.pos}: {p.name}</span>
                                            <span className="font-mono text-slate-500">{p.ppg} PPG</span>
                                        </div>
                                    ) : null;
                                })}
                                {team2Selected.size === 0 && <div className="text-slate-600 italic">No players selected</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!hasSelections && (
                    <div className="text-center py-4">
                        <p className="text-xs text-slate-500">Click players above to add them to the trade</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TradeSimulator;
