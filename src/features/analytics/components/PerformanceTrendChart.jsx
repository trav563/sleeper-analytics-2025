import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, Check } from 'lucide-react';

const PerformanceTrendChart = ({ weeklyMatchups, rosters, users, user }) => {
    // Determine the user's roster ID
    const userRosterId = useMemo(() => {
        if (!user || !rosters) return null;
        const roster = rosters.find(r => r.owner_id === user.user_id);
        return roster ? roster.roster_id : null;
    }, [user, rosters]);

    // Initial Selection: User + League Average
    const [selectedRosterIds, setSelectedRosterIds] = useState([]);
    const [initialized, setInitialized] = useState(false);
    const [hoveredLine, setHoveredLine] = useState(null);

    // Effect to initialize selection once data is ready
    if (!initialized && userRosterId) {
        setSelectedRosterIds([userRosterId, 'average']);
        setInitialized(true);
    } else if (!initialized && rosters && rosters.length > 0) {
        // Fallback if no user found
        setSelectedRosterIds([rosters[0].roster_id, 'average']);
        setInitialized(true);
    }

    const COLORS = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
        '#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'
    ];

    const toggleTeam = (rosterId) => {
        setSelectedRosterIds(prev => {
            if (prev.includes(rosterId)) {
                return prev.filter(id => id !== rosterId);
            } else {
                return [...prev, rosterId];
            }
        });
    };

    const processedData = useMemo(() => {
        if (!weeklyMatchups || weeklyMatchups.length === 0) return [];

        return weeklyMatchups.map(wm => {
            const dataPoint = { name: `W${wm.week}` };
            let weekTotal = 0;
            let weekCount = 0;

            wm.matchups.forEach(m => {
                if (m.points > 0) {
                    weekTotal += m.points;
                    weekCount++;
                }

                // Add all roster points to dataPoint for lines (filtering happens in render)
                // Actually optimization: strictly we only need selected ones, but for avg calc we need all.
                // Recharts needs keys for all potential lines if we want them to animate in/out or be available.
                // Let's attach all roster IDs.
                dataPoint[m.roster_id] = m.points;
            });

            // Calculate Average
            dataPoint['average'] = weekCount > 0 ? (weekTotal / weekCount) : 0;

            return dataPoint;
        });
    }, [weeklyMatchups]);

    const getTeamName = (rosterId) => {
        if (rosterId === 'average') return 'League Average';
        const roster = rosters.find(r => r.roster_id === parseInt(rosterId));
        const u = users.find(usr => usr.user_id === roster?.owner_id);
        return u?.display_name || `Roster ${rosterId}`;
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const sorted = [...payload].sort((a, b) => b.value - a.value);
            return (
                <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs z-50">
                    <p className="font-bold text-slate-300 mb-2">{label}</p>
                    {sorted.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-400">{entry.name}:</span>
                            <span className="font-mono font-bold text-white">{entry.value.toFixed(1)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (!weeklyMatchups || weeklyMatchups.length === 0) {
        return (
            <Card className="bg-slate-800/50 border-slate-700 h-[400px] flex items-center justify-center">
                <div className="text-center text-slate-500">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No performance data available</p>
                    <p className="text-xs">Waiting for season to start or data to load...</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        Performance Trend
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[450px] w-full pt-2 flex flex-col">
                <div className="flex-grow">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={processedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />

                            {/* League Average Line (Special Handling) */}
                            {selectedRosterIds.includes('average') && (
                                <Line
                                    key="average"
                                    type="monotone"
                                    dataKey="average"
                                    name="League Average"
                                    stroke="#94a3b8"
                                    strokeWidth={hoveredLine === 'average' ? 4 : 2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                    opacity={hoveredLine && hoveredLine !== 'average' ? 0.2 : 0.8}
                                    onMouseEnter={() => setHoveredLine('average')}
                                    onMouseLeave={() => setHoveredLine(null)}
                                />
                            )}

                            {/* Team Lines */}
                            {rosters.map((roster, index) => {
                                if (!selectedRosterIds.includes(roster.roster_id)) return null;

                                const teamName = getTeamName(roster.roster_id);
                                const isUserTeam = roster.roster_id === userRosterId;
                                const color = isUserTeam ? '#3b82f6' : COLORS[index % COLORS.length]; // Blue for user, cycle for others

                                const isHovered = hoveredLine === roster.roster_id;
                                const isDimmed = hoveredLine && hoveredLine !== roster.roster_id;

                                return (
                                    <Line
                                        key={roster.roster_id}
                                        type="monotone"
                                        dataKey={roster.roster_id}
                                        name={teamName}
                                        stroke={color}
                                        // Focus Mode Styles
                                        strokeWidth={isHovered ? 4 : (isUserTeam ? 3 : 2)}
                                        opacity={isDimmed ? 0.2 : 1}
                                        zIndex={isHovered || isUserTeam ? 50 : 1}
                                        dot={false}
                                        activeDot={{ r: 6 }}
                                        connectNulls={true}
                                        animationDuration={500}
                                        onMouseEnter={() => setHoveredLine(roster.roster_id)}
                                        onMouseLeave={() => setHoveredLine(null)}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Team Toggles (Legend Replacement) */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800 mt-2 justify-center">
                    {/* Average Toggle */}
                    <button
                        onClick={() => toggleTeam('average')}
                        className={`
                            text-[10px] px-2 py-1 rounded-full border transition-all flex items-center gap-1
                            ${selectedRosterIds.includes('average')
                                ? 'bg-slate-700 text-white border-slate-500'
                                : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'}
                        `}
                    >
                        {selectedRosterIds.includes('average') && <Check className="w-3 h-3" />}
                        League Average
                    </button>

                    {/* Roster Toggles */}
                    {rosters.map((r, index) => {
                        const isSelected = selectedRosterIds.includes(r.roster_id);
                        const isUserTeam = r.roster_id === userRosterId;
                        const user = users.find(u => u.user_id === r.owner_id);
                        const defaultColor = COLORS[index % COLORS.length];
                        const activeStyle = isUserTeam
                            ? 'bg-blue-500/20 text-blue-200 border-blue-500/50'
                            : `bg-slate-800 text-white border-[${defaultColor}]`; // Can't interpolate dynamic borders easily with TW, using style below

                        return (
                            <button
                                key={r.roster_id}
                                onClick={() => toggleTeam(r.roster_id)}
                                className={`
                                    text-[10px] px-2 py-1 rounded-full border transition-all flex items-center gap-1
                                    ${isSelected
                                        ? (isUserTeam ? 'bg-blue-500/20 text-blue-200 border-blue-500/50' : 'bg-slate-800 text-white border-slate-600')
                                        : 'bg-slate-900 text-slate-600 border-slate-800 hover:border-slate-600'}
                                `}
                                style={isSelected && !isUserTeam ? { borderColor: defaultColor } : {}}
                            >
                                {isSelected && <Check className="w-3 h-3" />}
                                {user?.display_name || `Team ${r.roster_id}`}
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default PerformanceTrendChart;
