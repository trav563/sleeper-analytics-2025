import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ArrowLeftRight, Check, X, RotateCcw } from 'lucide-react';
import { useSleeper } from '../../../context/SleeperContext';
import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const TradeSimulator = ({ league, rosters, users, players, currentWeek }) => {
    const { user } = useSleeper();
    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentWeek);

    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', league?.league_id],
        queryFn: () => fetchMarketValues(
            league?.roster_positions?.includes('SUPER_FLEX'),
            rosters?.length || 12,
            league?.scoring_settings?.rec ?? 0.5
        ),
        staleTime: 60 * 60 * 1000,
    });

    // Team selection
    const [team1Id, setTeam1Id] = useState(null);
    const [team2Id, setTeam2Id] = useState(null);
    const [team1Selected, setTeam1Selected] = useState(new Set());
    const [team2Selected, setTeam2Selected] = useState(new Set());

    // Default to logged-in user
    useMemo(() => {
        if (!rosters || team1Id) return;
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

    const getPlayerList = (roster) => {
        if (!roster || !players) return [];
        return (roster.players || [])
            .map(pid => {
                const p = players[pid];
                if (!p || !['QB', 'RB', 'WR', 'TE'].includes(p.position)) return null;
                return {
                    pid,
                    name: `${p.first_name} ${p.last_name}`,
                    pos: p.position,
                    team: p.team || 'FA',
                    age: p.age || '?',
                    value: marketValues?.[pid] || 0,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.value - a.value);
    };

    const team1Players = useMemo(() => getPlayerList(roster1), [roster1, players, marketValues]);
    const team2Players = useMemo(() => getPlayerList(roster2), [roster2, players, marketValues]);

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

    // Value comparison
    const team1Value = useMemo(() => {
        return [...team1Selected].reduce((sum, pid) => sum + (marketValues?.[pid] || 0), 0);
    }, [team1Selected, marketValues]);

    const team2Value = useMemo(() => {
        return [...team2Selected].reduce((sum, pid) => sum + (marketValues?.[pid] || 0), 0);
    }, [team2Selected, marketValues]);

    const valueDiff = Math.abs(team1Value - team2Value);
    const maxValue = Math.max(team1Value, team2Value) || 1;
    const fairnessRatio = valueDiff / maxValue;
    const fairnessColor = fairnessRatio <= 0.15 ? 'text-green-400' : fairnessRatio <= 0.3 ? 'text-yellow-400' : 'text-red-400';
    const fairnessLabel = fairnessRatio <= 0.15 ? 'Fair Trade' : fairnessRatio <= 0.3 ? 'Slight Edge' : 'Lopsided';

    // Radar chart data (before/after positional strength)
    const radarData = useMemo(() => {
        if (!seasonMatchups || !players || !roster1 || !roster2) return { before: [], after: [] };

        const calcPositionalAvg = (rosterPlayerIds) => {
            const posSums = { QB: 0, RB: 0, WR: 0, TE: 0 };
            const posCounts = { QB: 0, RB: 0, WR: 0, TE: 0 };

            Object.values(seasonMatchups).forEach(weekData => {
                if (!weekData) return;
                weekData.forEach(matchup => {
                    if (!rosterPlayerIds.has(matchup.roster_id)) return;
                    (matchup.starters || []).forEach((pid, idx) => {
                        const p = players[pid];
                        if (!p || !['QB', 'RB', 'WR', 'TE'].includes(p.position)) return;
                        const pts = matchup.starters_points?.[idx] || 0;
                        posSums[p.position] += pts;
                        posCounts[p.position]++;
                    });
                });
            });

            return ['QB', 'RB', 'WR', 'TE'].map(pos => ({
                subject: pos,
                value: posCounts[pos] > 0 ? parseFloat((posSums[pos] / posCounts[pos]).toFixed(1)) : 0,
            }));
        };

        // Before: current rosters
        const team1RosterSet = new Set([team1Id]);
        const team2RosterSet = new Set([team2Id]);
        const beforeTeam1 = calcPositionalAvg(team1RosterSet);
        const beforeTeam2 = calcPositionalAvg(team2RosterSet);

        // Combine before data for chart
        const before = beforeTeam1.map((item, i) => ({
            subject: item.subject,
            [displayTeamName(owner1)]: item.value,
            [displayTeamName(owner2)]: beforeTeam2[i]?.value || 0,
            fullMark: 30,
        }));

        return { before };
    }, [seasonMatchups, players, roster1, roster2, team1Id, team2Id, owner1, owner2]);

    const hasSelections = team1Selected.size > 0 || team2Selected.size > 0;
    const hasValues = marketValues && Object.keys(marketValues).length > 0;

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
                <p className="text-xs text-slate-400 mt-1">Select players from each team to simulate a trade</p>
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
                    {/* Team 1 */}
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                            {displayTeamName(owner1)} sends:
                        </p>
                        {team1Players.map(p => (
                            <button
                                key={p.pid}
                                onClick={() => togglePlayer(1, p.pid)}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                                    team1Selected.has(p.pid)
                                        ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                                        : 'bg-slate-700/30 hover:bg-slate-700/60 text-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-500 w-5">{p.pos}</span>
                                    <span className="truncate max-w-[100px]">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {hasValues && <span className="text-[10px] font-mono text-slate-500">{p.value.toLocaleString()}</span>}
                                    {team1Selected.has(p.pid) && <Check className="w-3 h-3 text-red-400" />}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Team 2 */}
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                            {displayTeamName(owner2)} sends:
                        </p>
                        {team2Players.map(p => (
                            <button
                                key={p.pid}
                                onClick={() => togglePlayer(2, p.pid)}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                                    team2Selected.has(p.pid)
                                        ? 'bg-green-500/20 border border-green-500/40 text-green-300'
                                        : 'bg-slate-700/30 hover:bg-slate-700/60 text-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-500 w-5">{p.pos}</span>
                                    <span className="truncate max-w-[100px]">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {hasValues && <span className="text-[10px] font-mono text-slate-500">{p.value.toLocaleString()}</span>}
                                    {team2Selected.has(p.pid) && <Check className="w-3 h-3 text-green-400" />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Trade Results */}
                {hasSelections && (
                    <div className="space-y-4 pt-2 border-t border-slate-700">
                        {/* Value Meter */}
                        {hasValues && (
                            <div className="bg-slate-900/50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-slate-400">Dynasty Value Comparison</span>
                                    <span className={`text-xs font-bold ${fairnessColor}`}>{fairnessLabel}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right flex-1">
                                        <div className="text-sm font-mono text-red-400">{team1Value.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500">{displayTeamName(owner1)} sends</div>
                                    </div>
                                    <div className="w-px h-8 bg-slate-700" />
                                    <div className="flex-1">
                                        <div className="text-sm font-mono text-green-400">{team2Value.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500">{displayTeamName(owner2)} sends</div>
                                    </div>
                                </div>
                                {valueDiff > 0 && (
                                    <div className="text-center mt-2">
                                        <span className="text-[10px] text-slate-500">
                                            Difference: <span className={fairnessColor}>{valueDiff.toLocaleString()}</span>
                                            {' '}({(fairnessRatio * 100).toFixed(0)}%)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Positional Radar */}
                        {radarData.before.length > 0 && (
                            <div className="bg-slate-900/50 rounded-lg p-4">
                                <p className="text-xs text-slate-400 mb-2">Positional Strength (Current)</p>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={radarData.before}>
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
                                    return p ? <div key={pid} className="text-slate-400">{p.pos}: {p.name}</div> : null;
                                })}
                                {team1Selected.size === 0 && <div className="text-slate-600 italic">No players selected</div>}
                            </div>
                            <div>
                                <p className="text-green-400 font-medium mb-1">{displayTeamName(owner2)} sends:</p>
                                {[...team2Selected].map(pid => {
                                    const p = team2Players.find(pl => pl.pid === pid);
                                    return p ? <div key={pid} className="text-slate-400">{p.pos}: {p.name}</div> : null;
                                })}
                                {team2Selected.size === 0 && <div className="text-slate-600 italic">No players selected</div>}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TradeSimulator;
