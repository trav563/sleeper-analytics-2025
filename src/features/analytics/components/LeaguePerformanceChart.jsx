import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Trophy, TrendingUp } from 'lucide-react';

const LeaguePerformanceChart = ({ weeklyMatchups, rosters, users }) => {
    // Transform data for Recharts
    // Structure: [ { name: 'W1', team1Id: points, team2Id: points ... }, ... ]

    // Create a color map for teams
    const COLORS = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
        '#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'
    ];

    const processedData = useMemo(() => {
        if (!weeklyMatchups || weeklyMatchups.length === 0) return [];

        return weeklyMatchups.map(wm => {
            const dataPoint = { name: `W${wm.week}` };
            wm.matchups.forEach(m => {
                dataPoint[m.roster_id] = m.points;
            });
            return dataPoint;
        });
    }, [weeklyMatchups]);

    // Format tooltip to show Team Name instead of Roster ID
    const getTeamName = (rosterId) => {
        const roster = rosters.find(r => r.roster_id === parseInt(rosterId));
        const user = users.find(u => u.user_id === roster?.owner_id);
        return user?.display_name || `Roster ${rosterId}`;
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            // Sort payload by value desc for better readability
            const sorted = [...payload].sort((a, b) => b.value - a.value);
            return (
                <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs">
                    <p className="font-bold text-slate-300 mb-2">{label}</p>
                    {sorted.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-400">{getTeamName(entry.dataKey)}:</span>
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
            <Card className="bg-slate-800/50 border-slate-700 min-h-[400px] flex items-center justify-center">
                <p className="text-slate-500 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Waiting for season data...
                </p>
            </Card>
        );
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    League Scoring Trends
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] w-full pt-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={processedData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value) => <span className="text-slate-400 text-xs ml-1">{getTeamName(value)}</span>}
                        />
                        {rosters.map((roster, index) => (
                            <Line
                                key={roster.roster_id}
                                type="monotone"
                                dataKey={roster.roster_id}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6 }}
                                connectNulls={true}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default LeaguePerformanceChart;
