import { useState, useEffect, useMemo } from 'react';
import { ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { fetchDraftPicks } from '../../../utils/sleeper';
import { useLeagueHistory } from '../../league/hooks/useLeagueHistory';
import { useCareerStats } from '../../stats/hooks/useCareerStats';
import { useSleeper } from '../../../context/SleeperContext';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { TrendingUp } from 'lucide-react';
import { Pip } from '../../../components/ui/Pip';
import { theme } from '../../../lib/theme';

// Recharts colors mapped to broadcast tokens (kept stable across positions)
const POSITION_FILL = {
    QB: theme.color.bad,
    RB: theme.color.good,
    WR: theme.color.signal,
    TE: theme.color.signal2,
    K:  theme.color.warn,
    DEF: theme.color.textDim,
};

const GMPerformance = ({ league, players, users, rosters }) => {
    const { user } = useSleeper();
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [picks, setPicks] = useState([]);
    const [loadingDraft, setLoadingDraft] = useState(false);
    const [selectedRosterId, setSelectedRosterId] = useState(null);

    const { history, loading: loadingHistory } = useLeagueHistory(league?.league_id);

    useEffect(() => {
        if (league?.season && !selectedSeason) {
            setSelectedSeason(league.season);
        }
    }, [league, selectedSeason]);

    const activeLeagueData = useMemo(() => {
        if (!history || !selectedSeason) return null;
        return history.find(h => h.season === selectedSeason) ||
            (league?.season === selectedSeason ? { league_id: league.league_id, draft_id: league.draft_id } : null);
    }, [history, selectedSeason, league]);

    useEffect(() => {
        async function loadDraft() {
            // Clear stale picks — otherwise switching to a season with no draft
            // renders the previous season's picks against the new season's stats.
            if (!activeLeagueData?.draft_id) { setPicks([]); return; }
            setLoadingDraft(true);
            try {
                const data = await fetchDraftPicks(activeLeagueData.draft_id);
                setPicks(data);
            } catch (e) {
                console.error("Failed to load draft picks", e);
            } finally {
                setLoadingDraft(false);
            }
        }
        loadDraft();
    }, [activeLeagueData]);

    const currentSeason = league?.season || '2025';
    const { careerStats, loading: loadingStats } = useCareerStats(selectedSeason, currentSeason, league?.scoring_settings);

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

    const [hoveredPoint, setHoveredPoint] = useState(null);

    const maxDraftPoints = useMemo(() => {
        if (!picks || !careerStats) return 0;
        let max = 0;
        picks.forEach(p => {
            const stat = careerStats[p.player_id];
            if (stat && stat.totalPoints > max) max = stat.totalPoints;
        });
        return max;
    }, [picks, careerStats]);

    const { chartData, curveData, summary } = useMemo(() => {
        if (!picks || !careerStats || !players || !selectedRosterId || maxDraftPoints === 0) {
            return { chartData: [], curveData: [], summary: { wins: 0, solid: 0, busts: 0 } };
        }

        const teamPicks = picks.filter(p => p.roster_id === selectedRosterId);
        let wins = 0, solid = 0, busts = 0;

        const processedPicks = teamPicks.map(pick => {
            const pid = pick.player_id;
            const stat = careerStats[pid];
            const player = players[pid];

            if (!stat || !player) return null;

            const expected = maxDraftPoints * (1 / (Math.log(pick.pick_no) + 1)) * 1.5;
            const diff = stat.totalPoints - expected;
            const roi = expected > 0 ? diff / expected : 0;

            let tier = 'Solid';
            if (roi > 0.2) { tier = 'Winner'; wins++; }
            else if (roi < -0.2) { tier = 'Bust'; busts++; }
            else { solid++; }

            const currentRoster = rosters.find(r => r.roster_id === selectedRosterId);
            const isOnTeam = currentRoster?.players?.includes(pid);

            return {
                pickNo: pick.pick_no,
                points: stat.totalPoints,
                expected,
                name: `${player.first_name} ${player.last_name}`,
                position: player.position,
                tier,
                roi,
                isOnTeam,
                round: pick.round,
                draftSlot: pick.draft_slot
            };
        }).filter(Boolean);

        const curve = [];
        const maxPick = Math.max(...picks.map(p => p.pick_no), 50);
        for (let i = 1; i <= maxPick; i++) {
            const exp = maxDraftPoints * (1 / (Math.log(i) + 1)) * 1.5;
            curve.push({
                pickNo: i,
                expected: exp,
                upper: exp * 1.2,
                lower: exp * 0.8
            });
        }

        return { chartData: processedPicks, curveData: curve, summary: { wins, solid, busts } };
    }, [picks, careerStats, players, selectedRosterId, maxDraftPoints, rosters]);

    const getOwner = (rosterId) => users.find(u => u.user_id === rosters.find(r => r.roster_id === rosterId)?.owner_id);
    const selectedOwner = getOwner(selectedRosterId);

    // Nothing to plot: either the class has no draft on record, or its players
    // haven't scored yet (rookies always start here).
    const isEmpty = chartData.length === 0;
    const noDraftYet = !picks || picks.length === 0;

    if (loadingDraft || loadingStats || loadingHistory) {
        return (
            <div className="p-8 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                Loading GM Performance…
            </div>
        );
    }

    const CustomShape = (props) => {
        const { cx, cy, fill, payload, onMouseEnter, onMouseLeave } = props;
        const handleMouseEnter = (e) => onMouseEnter && onMouseEnter({ ...props, cx, cy }, e);
        const handleMouseLeave = (e) => onMouseLeave && onMouseLeave(e);

        if (payload.isOnTeam) {
            return <circle cx={cx} cy={cy} r={6} fill={fill} stroke="none" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ cursor: 'pointer' }} />;
        }
        return <circle cx={cx} cy={cy} r={5} fill="transparent" stroke={fill} strokeWidth={2} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ cursor: 'pointer' }} />;
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-good" aria-hidden="true" />
                        GM Performance
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold tracking-snug text-text">
                        Draft ROI vs Expectation
                    </h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <select
                        className="bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                        value={selectedSeason || ''}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        disabled={loadingHistory}
                    >
                        {history.map(h => (
                            <option key={h.season} value={h.season}>{h.season} Class</option>
                        ))}
                        {!history.find(h => h.season === league?.season) && league?.season && (
                            <option value={league.season}>{league.season} Class</option>
                        )}
                    </select>

                    <select
                        className="bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast md:w-64"
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

            <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card relative">
                <div className="flex items-center gap-3 mb-5">
                    {selectedOwner?.avatar ? (
                        <img
                            src={avatarUrl(selectedOwner.avatar)}
                            alt=""
                            className="w-12 h-12 rounded-full ring-1 ring-line"
                        />
                    ) : (
                        <Pip seed={selectedRosterId ?? 'team'} name={displayTeamName(selectedOwner)} size={48} />
                    )}
                    <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold text-text truncate">{displayTeamName(selectedOwner)}</h3>
                        {!isEmpty && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-2xs uppercase tracking-wider mt-1">
                                <span className="text-good"><span className="tnum">{summary.wins}</span> Steals</span>
                                <span className="text-text-mute" aria-hidden="true">·</span>
                                <span className="text-text-dim"><span className="tnum">{summary.solid}</span> Solid</span>
                                <span className="text-text-mute" aria-hidden="true">·</span>
                                <span className="text-bad"><span className="tnum">{summary.busts}</span> Busts</span>
                            </div>
                        )}
                    </div>
                </div>

                {isEmpty ? (
                    <div className="text-center p-12 space-y-3">
                        <TrendingUp className="w-10 h-10 text-text-mute mx-auto" aria-hidden="true" />
                        <h3 className="font-display text-lg font-semibold text-text">
                            {noDraftYet ? `No ${selectedSeason} Draft Yet` : `No ROI Yet for the ${selectedSeason} Class`}
                        </h3>
                        <p className="text-sm text-text-dim max-w-md mx-auto">
                            {noDraftYet
                                ? `This season doesn't have a completed draft on record, so there are no picks to grade.`
                                : `Draft ROI compares each pick against the points it went on to score. The ${selectedSeason} class hasn't played any games yet — check back once the season is under way.`}
                        </p>
                    </div>
                ) : (
                <div className="h-96 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme.color.lineStrong} vertical={false} />
                            <XAxis
                                type="number"
                                dataKey="pickNo"
                                name="Pick"
                                stroke={theme.color.textDim}
                                domain={[1, 'auto']}
                                label={{ value: 'Overall Pick Number', position: 'insideBottom', offset: -10, fill: theme.color.textMute, fontSize: 11 }}
                            />
                            <YAxis
                                type="number"
                                dataKey="points"
                                name="Points"
                                stroke={theme.color.textDim}
                                label={{ value: 'Career Points (PPR)', angle: -90, position: 'insideLeft', fill: theme.color.textMute, fontSize: 11 }}
                            />

                            <Area
                                type="monotone"
                                data={curveData}
                                dataKey="upper"
                                stroke="none"
                                fill={theme.color.good}
                                fillOpacity={0.06}
                                isAnimationActive={false}
                                style={{ pointerEvents: 'none' }}
                            />
                            <Area
                                type="monotone"
                                data={curveData}
                                dataKey="lower"
                                stroke="none"
                                fill={theme.color.bad}
                                fillOpacity={0.06}
                                isAnimationActive={false}
                                style={{ pointerEvents: 'none' }}
                            />

                            <Line
                                type="monotone"
                                data={curveData}
                                dataKey="expected"
                                stroke={theme.color.textMute}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={false}
                                isAnimationActive={false}
                                style={{ pointerEvents: 'none' }}
                            />

                            <Scatter
                                name="Players"
                                data={chartData}
                                shape={<CustomShape />}
                                onMouseEnter={(props) => setHoveredPoint(props)}
                                onMouseLeave={() => setHoveredPoint(null)}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={POSITION_FILL[entry.position] || theme.color.textDim}
                                    />
                                ))}
                            </Scatter>
                        </ComposedChart>
                    </ResponsiveContainer>

                    {hoveredPoint && (
                        <div
                            className="absolute bg-bg-1 border border-line p-3 rounded-md shadow-pop text-xs z-50 pointer-events-none w-52"
                            style={{
                                left: hoveredPoint.cx,
                                top: hoveredPoint.cy,
                                transform: 'translate(-50%, -110%)'
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full ${
                                    hoveredPoint.payload.tier === 'Winner' ? 'bg-good'
                                    : hoveredPoint.payload.tier === 'Bust' ? 'bg-bad'
                                    : 'bg-text-mute'
                                }`} />
                                <span className="font-semibold text-text text-sm truncate">{hoveredPoint.payload.name}</span>
                                <span className="font-mono text-2xs text-text-mute">({hoveredPoint.payload.position})</span>
                            </div>

                            <div className="space-y-1 mb-2">
                                <p className="text-text-dim">
                                    <span className="text-text-mute font-mono text-2xs uppercase tracking-wider">Draft</span>{' '}
                                    <span className="tnum">R{hoveredPoint.payload.round} · Pick {hoveredPoint.payload.draftSlot} · Ov {hoveredPoint.payload.pickNo}</span>
                                </p>
                                <p className="text-text-dim">
                                    <span className="text-text-mute font-mono text-2xs uppercase tracking-wider">Career</span>{' '}
                                    <span className="tnum">{hoveredPoint.payload.points.toFixed(1)}</span>
                                    <span className="text-text-mute"> / target </span>
                                    <span className="tnum">{hoveredPoint.payload.expected.toFixed(1)}</span>
                                </p>
                            </div>

                            <div className={`font-semibold font-mono text-2xs uppercase tracking-wider text-center py-1 rounded-sm ${
                                hoveredPoint.payload.tier === 'Winner' ? 'bg-good/15 text-good'
                                : hoveredPoint.payload.tier === 'Bust' ? 'bg-bad/15 text-bad'
                                : 'bg-bg-3 text-text-dim'
                            }`}>
                                {hoveredPoint.payload.tier === 'Winner'
                                    ? <>Steal · +<span className="tnum">{(hoveredPoint.payload.roi * 100).toFixed(0)}</span>% ROI</>
                                    : hoveredPoint.payload.tier === 'Bust'
                                    ? <>Bust · <span className="tnum">{(hoveredPoint.payload.roi * 100).toFixed(0)}</span>% ROI</>
                                    : 'Solid · fair value'}
                            </div>

                            {!hoveredPoint.payload.isOnTeam && (
                                <p className="text-2xs text-text-mute mt-1 italic text-center">No longer on roster</p>
                            )}
                        </div>
                    )}
                </div>
                )}

                {!isEmpty && (
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 font-mono text-2xs uppercase tracking-wider text-text-mute">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-text-dim" /> On Roster
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-text-dim" /> Traded / Dropped
                        </div>
                        <div className="flex items-center gap-2">
                            <span style={{ color: POSITION_FILL.QB }} className="font-bold">QB</span>
                            <span style={{ color: POSITION_FILL.RB }} className="font-bold">RB</span>
                            <span style={{ color: POSITION_FILL.WR }} className="font-bold">WR</span>
                            <span style={{ color: POSITION_FILL.TE }} className="font-bold">TE</span>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default GMPerformance;
