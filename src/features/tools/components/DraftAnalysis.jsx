import { useState, useEffect, useMemo } from 'react';
import { ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { fetchDraftPicks } from '../../../utils/sleeper';
import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { User, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const DraftAnalysis = ({ league, currentWeek, players, users, rosters }) => {
    const [picks, setPicks] = useState([]);
    const [loadingDraft, setLoadingDraft] = useState(false);
    const [selectedRosterId, setSelectedRosterId] = useState(null);
    const { seasonMatchups, loading: loadingMatchups } = useSeasonMatchups(league?.league_id, currentWeek);
    const playerStats = usePlayerStats(seasonMatchups);

    // Initialize selected roster
    useEffect(() => {
        if (!selectedRosterId && rosters && rosters.length > 0) {
            setSelectedRosterId(rosters[0].roster_id);
        }
    }, [rosters, selectedRosterId]);

    // Fetch Draft Data
    useEffect(() => {
        async function loadDraft() {
            if (!league?.draft_id) return;
            setLoadingDraft(true);
            try {
                const data = await fetchDraftPicks(league.draft_id);
                setPicks(data);
            } catch (e) {
                console.error("Failed to load draft picks", e);
            } finally {
                setLoadingDraft(false);
            }
        }
        loadDraft();
    }, [league]);

    // Calculate Max Points in the Draft Class for Expected Value Model
    const maxDraftPoints = useMemo(() => {
        if (!picks || !playerStats) return 0;
        let max = 0;
        picks.forEach(p => {
            const stat = playerStats[p.player_id];
            if (stat && stat.totalPoints > max) max = stat.totalPoints;
        });
        return max;
    }, [picks, playerStats]);

    // Process Data for Selected Team
    const { chartData, curveData, summary } = useMemo(() => {
        if (!picks || !playerStats || !players || !selectedRosterId || maxDraftPoints === 0) {
            return { chartData: [], curveData: [], summary: { wins: 0, solid: 0, busts: 0 } };
        }

        const teamPicks = picks.filter(p => p.roster_id === selectedRosterId);
        let wins = 0, solid = 0, busts = 0;

        const processedPicks = teamPicks.map(pick => {
            const pid = pick.player_id;
            const stat = playerStats[pid];
            const player = players[pid];

            if (!stat || !player) return null;

            // Expected Value Model: Max * (1 / (ln(Pick) + 1))
            // Adding 1 to pick_no to avoid log(0) issues if pick is 0 (though usually 1-based)
            // Using Math.log (natural log)
            const expected = maxDraftPoints * (1 / (Math.log(pick.pick_no) + 1));

            const diff = stat.totalPoints - expected;
            const roi = expected > 0 ? diff / expected : 0;

            let tier = 'Solid';
            if (roi > 0.2) { tier = 'Winner'; wins++; }
            else if (roi < -0.2) { tier = 'Bust'; busts++; }
            else { solid++; }

            // Check if still on team
            // We need to check the current roster of the player.
            // Since we don't have easy access to "current roster of every player" without iterating all rosters,
            // let's check if this player ID is in the selected roster's player list.
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

        // Generate Curve Data for Background
        const curve = [];
        const maxPick = Math.max(...picks.map(p => p.pick_no), 50); // At least 50
        for (let i = 1; i <= maxPick; i++) {
            const exp = maxDraftPoints * (1 / (Math.log(i) + 1));
            curve.push({
                pickNo: i,
                expected: exp,
                upper: exp * 1.2, // Top of Solid Zone
                lower: exp * 0.8  // Bottom of Solid Zone
            });
        }

        return { chartData: processedPicks, curveData: curve, summary: { wins, solid, busts } };

    }, [picks, playerStats, players, selectedRosterId, maxDraftPoints, rosters]);

    const getOwner = (rosterId) => users.find(u => u.user_id === rosters.find(r => r.roster_id === rosterId)?.owner_id);
    const selectedOwner = getOwner(selectedRosterId);

    if (loadingDraft || loadingMatchups) return <div className="p-8 text-center text-gray-400">Loading GM Performance...</div>;

    const [hoveredPoint, setHoveredPoint] = useState(null);

    // Custom Shape for Scatter
    const CustomShape = (props) => {
        const { cx, cy, fill, payload, onMouseEnter, onMouseLeave } = props;

        // We need to pass the event handlers to the shape so they trigger
        const handleMouseEnter = (e) => {
            onMouseEnter && onMouseEnter({ ...props, cx, cy }, e);
        };

        const handleMouseLeave = (e) => {
            onMouseLeave && onMouseLeave(e);
        };

        if (payload.isOnTeam) {
            return <circle cx={cx} cy={cy} r={6} fill={fill} stroke="none" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ cursor: 'pointer' }} />;
        } else {
            return <circle cx={cx} cy={cy} r={5} fill="transparent" stroke={fill} strokeWidth={2} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ cursor: 'pointer' }} />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-green-400" />
                        GM Performance
                    </h2>
                    <p className="text-sm text-slate-400">Draft ROI analysis vs League Expectation.</p>
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

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 relative">
                <div className="flex items-center gap-4 mb-6">
                    <img
                        src={avatarUrl(selectedOwner?.avatar)}
                        alt=""
                        className="w-12 h-12 rounded-full border-2 border-slate-600"
                    />
                    <div>
                        <h3 className="text-lg font-bold text-white">{displayTeamName(selectedOwner)}</h3>
                        <div className="flex gap-3 text-xs mt-1">
                            <span className="text-green-400 font-medium">{summary.wins} Steals</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-300 font-medium">{summary.solid} Solid</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-red-400 font-medium">{summary.busts} Busts</span>
                        </div>
                    </div>
                </div>

                <div className="h-96 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis
                                type="number"
                                dataKey="pickNo"
                                name="Pick"
                                stroke="#94a3b8"
                                domain={[1, 'auto']}
                                label={{ value: 'Overall Pick Number', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 12 }}
                            />
                            <YAxis
                                type="number"
                                dataKey="points"
                                name="Points"
                                stroke="#94a3b8"
                                label={{ value: 'Career Points', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                            />

                            {/* Zones */}
                            <Area
                                type="monotone"
                                data={curveData}
                                dataKey="upper"
                                stroke="none"
                                fill="#22c55e"
                                fillOpacity={0.05}
                                isAnimationActive={false}
                                style={{ pointerEvents: 'none' }}
                            />
                            <Area
                                type="monotone"
                                data={curveData}
                                dataKey="lower"
                                stroke="none"
                                fill="#ef4444"
                                fillOpacity={0.05}
                                isAnimationActive={false}
                                style={{ pointerEvents: 'none' }}
                            />

                            {/* Par Line */}
                            <Line
                                type="monotone"
                                data={curveData}
                                dataKey="expected"
                                stroke="#64748b"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={false}
                                isAnimationActive={false}
                                style={{ pointerEvents: 'none' }}
                            />

                            {/* Players */}
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
                                        fill={
                                            entry.position === 'QB' ? '#ef4444' :
                                                entry.position === 'RB' ? '#22c55e' :
                                                    entry.position === 'WR' ? '#3b82f6' :
                                                        '#f97316' // TE
                                        }
                                    />
                                ))}
                            </Scatter>
                        </ComposedChart>
                    </ResponsiveContainer>

                    {/* Manual Tooltip */}
                    {hoveredPoint && (
                        <div
                            className="absolute bg-slate-800 border border-slate-700 p-3 rounded shadow-lg text-xs z-50 pointer-events-none w-48"
                            style={{
                                left: hoveredPoint.cx,
                                top: hoveredPoint.cy,
                                transform: 'translate(-50%, -110%)' // Center horizontally, move above dot
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full ${hoveredPoint.payload.tier === 'Winner' ? 'bg-green-400' : hoveredPoint.payload.tier === 'Bust' ? 'bg-red-400' : 'bg-slate-400'}`} />
                                <span className="font-bold text-white text-sm truncate">{hoveredPoint.payload.name}</span>
                                <span className="text-slate-400">({hoveredPoint.payload.position})</span>
                            </div>

                            <div className="space-y-1 mb-2">
                                <p className="text-slate-300">
                                    <span className="text-slate-500">Draft:</span> R{hoveredPoint.payload.round} • Pick {hoveredPoint.payload.draftSlot} (Ov {hoveredPoint.payload.pickNo})
                                </p>
                                <p className="text-slate-300">
                                    <span className="text-slate-500">Points:</span> {hoveredPoint.payload.points.toFixed(1)} <span className="text-slate-600">/ Exp: {hoveredPoint.payload.expected.toFixed(1)}</span>
                                </p>
                            </div>

                            <div className={`font-bold text-center py-1 rounded ${hoveredPoint.payload.tier === 'Winner' ? 'bg-green-500/20 text-green-400' :
                                    hoveredPoint.payload.tier === 'Bust' ? 'bg-red-500/20 text-red-400' :
                                        'bg-slate-500/20 text-slate-300'
                                }`}>
                                {hoveredPoint.payload.tier === 'Winner' ? `✅ STEAL (+${(hoveredPoint.payload.roi * 100).toFixed(0)}% ROI)` :
                                    hoveredPoint.payload.tier === 'Bust' ? `❌ BUST (${(hoveredPoint.payload.roi * 100).toFixed(0)}% ROI)` :
                                        `⚖️ SOLID (Fair Value)`}
                            </div>

                            {!hoveredPoint.payload.isOnTeam && (
                                <p className="text-[10px] text-slate-500 mt-1 italic text-center">No longer on roster</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-center gap-6 mt-4 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-500" /> On Roster
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-2 border-slate-500" /> Traded/Dropped
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-red-400 font-bold">QB</span>
                        <span className="text-green-400 font-bold">RB</span>
                        <span className="text-blue-400 font-bold">WR</span>
                        <span className="text-orange-400 font-bold">TE</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DraftAnalysis;
