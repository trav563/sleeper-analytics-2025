import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ArrowLeftRight, Check, RotateCcw } from 'lucide-react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchSleeper } from '../../../utils/sleeper';
import { displayTeamName } from '../../../utils/nflData';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../lib/theme';

const TradeSimulator = ({ league, rosters, users, players }) => {
    const { user } = useSleeper();

    const leagueSeason = league?.season || '2025';
    const prevSeason = String(Number(leagueSeason) - 1);

    const { data: seasonStats } = useQuery({
        queryKey: ['seasonStats', prevSeason],
        queryFn: () => fetchSleeper(`/stats/nfl/regular/${prevSeason}`),
        staleTime: 60 * 60 * 1000,
        enabled: !!league,
    });

    const pprField = useMemo(() => {
        const rec = league?.scoring_settings?.rec ?? 0;
        if (rec >= 1) return 'pts_ppr';
        if (rec >= 0.5) return 'pts_half_ppr';
        return 'pts_std';
    }, [league]);

    const [team1Id, setTeam1Id] = useState(null);
    const [team2Id, setTeam2Id] = useState(null);
    const [team1Selected, setTeam1Selected] = useState(new Set());
    const [team2Selected, setTeam2Selected] = useState(new Set());

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

                return { pid, name: `${p.first_name} ${p.last_name}`, pos: p.position, team: p.team || 'FA', age: p.age || '?', ppg, gp };
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

    const team1PPG = useMemo(() => [...team1Selected].reduce((sum, pid) => {
        const p = team1Players.find(pl => pl.pid === pid);
        return sum + (p?.ppg || 0);
    }, 0), [team1Selected, team1Players]);

    const team2PPG = useMemo(() => [...team2Selected].reduce((sum, pid) => {
        const p = team2Players.find(pl => pl.pid === pid);
        return sum + (p?.ppg || 0);
    }, 0), [team2Selected, team2Players]);

    const ppgDiff = Math.abs(team1PPG - team2PPG);
    const maxPPG = Math.max(team1PPG, team2PPG) || 1;
    const fairnessRatio = ppgDiff / maxPPG;
    const fairnessColor = fairnessRatio <= 0.15 ? 'text-good' : fairnessRatio <= 0.3 ? 'text-warn' : 'text-bad';
    const fairnessLabel = fairnessRatio <= 0.15 ? 'Fair Trade' : fairnessRatio <= 0.3 ? 'Slight Edge' : 'Lopsided';

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
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5 text-signal" aria-hidden="true" />
                        <div>
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Tool · Trade Simulator
                            </div>
                            <h3 className="font-display text-lg font-semibold text-text">Trade Simulator</h3>
                        </div>
                    </div>
                    {hasSelections && (
                        <Button onClick={reset} variant="ghost" size="sm" className="text-text-dim hover:text-text hover:bg-bg-2">
                            <RotateCcw className="w-4 h-4 mr-1" /> Reset
                        </Button>
                    )}
                </div>
                <p className="text-xs text-text-dim mt-1">
                    Select players from each team to simulate a trade
                    {hasStats && <span className="text-text-mute"> — values based on <span className="tnum">{prevSeason}</span> season PPG</span>}
                </p>
            </header>

            <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <select
                        className="bg-bg-2 border border-line text-text text-sm rounded-md min-h-[40px] px-3 focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                        value={team1Id || ''}
                        onChange={(e) => { setTeam1Id(Number(e.target.value)); setTeam1Selected(new Set()); }}
                    >
                        {rosters.map(r => {
                            const o = users?.find(u => u.user_id === r.owner_id);
                            return <option key={r.roster_id} value={r.roster_id}>{displayTeamName(o)}</option>;
                        })}
                    </select>
                    <select
                        className="bg-bg-2 border border-line text-text text-sm rounded-md min-h-[40px] px-3 focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                        value={team2Id || ''}
                        onChange={(e) => { setTeam2Id(Number(e.target.value)); setTeam2Selected(new Set()); }}
                    >
                        {rosters.filter(r => r.roster_id !== team1Id).map(r => {
                            const o = users?.find(u => u.user_id === r.owner_id);
                            return <option key={r.roster_id} value={r.roster_id}>{displayTeamName(o)}</option>;
                        })}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {[
                        { players: team1Players, selected: team1Selected, side: 1, owner: owner1, tone: 'signal' },
                        { players: team2Players, selected: team2Selected, side: 2, owner: owner2, tone: 'signal-2' },
                    ].map(({ players: pList, selected, side, owner, tone }) => (
                        <div key={side} className="space-y-1 max-h-72 overflow-y-auto pr-1">
                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">
                                {displayTeamName(owner)} sends:
                            </p>
                            {pList.map(p => {
                                const isSelected = selected.has(p.pid);
                                const selectedClass = tone === 'signal'
                                    ? 'bg-signal/15 border-signal/40 text-signal'
                                    : 'bg-signal-2/15 border-signal-2/40 text-signal-2';
                                return (
                                    <button
                                        key={p.pid}
                                        type="button"
                                        onClick={() => togglePlayer(side, p.pid)}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs border transition-colors duration-fast ${
                                            isSelected
                                                ? selectedClass
                                                : 'bg-bg-2 border-line text-text-dim hover:bg-bg-3 hover:text-text'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-mono font-bold text-text-mute w-6 text-2xs uppercase">{p.pos}</span>
                                            <span className="truncate max-w-[100px]">{p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {p.ppg > 0 && <span className="font-mono text-2xs text-text-mute tnum">{p.ppg} PPG</span>}
                                            {isSelected && <Check className="w-3 h-3" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {hasSelections && (
                    <div className="space-y-4 pt-3 border-t border-line">
                        <div className="bg-bg-2 rounded-md p-4 border border-line">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Combined PPG</span>
                                {team1Selected.size > 0 && team2Selected.size > 0 && (
                                    <span className={`font-mono text-2xs uppercase tracking-wider font-bold ${fairnessColor}`}>{fairnessLabel}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right flex-1">
                                    <div className="tnum font-display text-lg font-bold text-signal">{team1PPG.toFixed(1)} <span className="text-2xs font-mono text-text-mute">PPG</span></div>
                                    <div className="font-mono text-2xs text-text-mute uppercase tracking-wider">{displayTeamName(owner1)} sends</div>
                                </div>
                                <div className="w-px h-8 bg-line-strong" />
                                <div className="flex-1">
                                    <div className="tnum font-display text-lg font-bold text-signal-2">{team2PPG.toFixed(1)} <span className="text-2xs font-mono text-text-mute">PPG</span></div>
                                    <div className="font-mono text-2xs text-text-mute uppercase tracking-wider">{displayTeamName(owner2)} sends</div>
                                </div>
                            </div>
                        </div>

                        {radarData.length > 0 && (
                            <div className="bg-bg-2 rounded-md p-4 border border-line">
                                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">
                                    Positional Strength · <span className="tnum">{prevSeason}</span> PPG
                                </p>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={radarData}>
                                            <PolarGrid stroke={theme.color.lineStrong} />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: theme.color.textDim, fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                            <Tooltip contentStyle={{
                                                backgroundColor: theme.color.bg1,
                                                border: `1px solid ${theme.color.lineStrong}`,
                                                borderRadius: theme.radius.md,
                                                color: theme.color.text,
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: 12,
                                            }} />
                                            <Radar name={displayTeamName(owner1)} dataKey={displayTeamName(owner1)} stroke={theme.color.signal} fill={theme.color.signal} fillOpacity={0.35} />
                                            <Radar name={displayTeamName(owner2)} dataKey={displayTeamName(owner2)} stroke={theme.color.signal2} fill={theme.color.signal2} fillOpacity={0.35} />
                                            <Legend wrapperStyle={{ color: theme.color.textDim, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <p className="font-mono text-2xs uppercase tracking-wider text-signal mb-1.5">{displayTeamName(owner1)} sends</p>
                                {[...team1Selected].map(pid => {
                                    const p = team1Players.find(pl => pl.pid === pid);
                                    return p ? (
                                        <div key={pid} className="flex justify-between text-text-dim">
                                            <span><span className="font-mono text-2xs text-text-mute">{p.pos}</span> {p.name}</span>
                                            <span className="font-mono text-text-mute tnum">{p.ppg} PPG</span>
                                        </div>
                                    ) : null;
                                })}
                                {team1Selected.size === 0 && <div className="text-text-mute italic">No players selected</div>}
                            </div>
                            <div>
                                <p className="font-mono text-2xs uppercase tracking-wider text-signal-2 mb-1.5">{displayTeamName(owner2)} sends</p>
                                {[...team2Selected].map(pid => {
                                    const p = team2Players.find(pl => pl.pid === pid);
                                    return p ? (
                                        <div key={pid} className="flex justify-between text-text-dim">
                                            <span><span className="font-mono text-2xs text-text-mute">{p.pos}</span> {p.name}</span>
                                            <span className="font-mono text-text-mute tnum">{p.ppg} PPG</span>
                                        </div>
                                    ) : null;
                                })}
                                {team2Selected.size === 0 && <div className="text-text-mute italic">No players selected</div>}
                            </div>
                        </div>
                    </div>
                )}

                {!hasSelections && (
                    <div className="text-center py-4">
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">Click players above to add them to the trade</p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default TradeSimulator;
