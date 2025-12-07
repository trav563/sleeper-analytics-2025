import { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Switch } from '../../../components/ui/Switch';

const DynastyLandscape = ({ rosters, users, players, league }) => {
    const [useMaxPf, setUseMaxPf] = useState(false);

    const data = useMemo(() => {
        if (!rosters || !users || !players) return [];

        const teams = rosters.map(roster => {
            const owner = users.find(u => u.user_id === roster.owner_id);

            // 1. Calculate Production (Y-Axis)
            const gamesPlayed = (roster.settings?.wins || 0) + (roster.settings?.losses || 0) + (roster.settings?.ties || 0) || 1;
            const ppg = ((roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100) / gamesPlayed;
            const maxPf = (roster.settings?.ppts || 0) + (roster.settings?.ppts_decimal || 0) / 100;
            const productionMetric = useMaxPf ? maxPf : ppg;

            // 2. Calculate Average Age (X-Axis)
            // Filter: Only relevant positions (QB, RB, WR, TE). Ignore K, DEF.
            // Filter: Ignore empty slots or players not in DB.
            const validPlayers = (roster.players || [])
                .map(id => players[id])
                .filter(p => p && ['QB', 'RB', 'WR', 'TE'].includes(p.position) && p.age);

            // Simple Average of entire valid roster (could act as "Top N" if we sorted, but all valid players is a good proxy for "Team Age")
            const totalAge = validPlayers.reduce((sum, p) => sum + (p.age || 0), 0);
            const avgAge = validPlayers.length > 0 ? totalAge / validPlayers.length : 0;

            return {
                rosterId: roster.roster_id,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar),
                age: parseFloat(avgAge.toFixed(1)),
                production: parseFloat(productionMetric.toFixed(1)),
                productionLabel: useMaxPf ? 'Max PF' : 'PPG',
                gamesPlayed
            };
        });

        return teams.filter(t => t.age > 0);
    }, [rosters, users, players, useMaxPf]);

    // Calculate Averages for Quadrants
    const averages = useMemo(() => {
        if (data.length === 0) return { age: 0, production: 0 };
        const totalAge = data.reduce((sum, t) => sum + t.age, 0);
        const totalProd = data.reduce((sum, t) => sum + t.production, 0);
        return {
            age: parseFloat((totalAge / data.length).toFixed(1)),
            production: parseFloat((totalProd / data.length).toFixed(1))
        };
    }, [data]);

    // Custom Scatter Point (Avatar)
    const CustomNode = (props) => {
        const { cx, cy, payload } = props;
        return (
            <foreignObject x={cx - 15} y={cy - 15} width={30} height={30}>
                <img
                    src={payload.avatar}
                    alt={payload.name}
                    className="w-[30px] h-[30px] rounded-full border-2 border-white/20 hover:scale-125 transition-transform cursor-pointer shadow-lg"
                    title={payload.name}
                />
            </foreignObject>
        );
    };

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;

            // Classify
            let classification = "";
            if (data.production >= averages.production && data.age <= averages.age) classification = "👑 Dynasty King";
            else if (data.production >= averages.production && data.age > averages.age) classification = "🏆 Win-Now Contender";
            else if (data.production < averages.production && data.age <= averages.age) classification = "🛠️ Productive Struggle";
            else classification = "⚠️ Danger Zone";

            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
                    <p className="font-bold text-white mb-1">{data.name}</p>
                    <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex justify-between gap-4">
                            <span>Avg Age:</span>
                            <span className="font-mono text-white">{data.age} yrs</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>{data.productionLabel}:</span>
                            <span className={`font-mono font-bold ${data.production >= averages.production ? 'text-green-400' : 'text-red-400'}`}>
                                {data.production}
                            </span>
                        </div>
                        <div className="pt-2 mt-1 border-t border-slate-800 text-center font-bold text-blue-300">
                            {classification}
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!data || data.length === 0) return null;

    // Determine Axis Domains to center the data nicely
    const minAge = Math.floor(Math.min(...data.map(d => d.age)) - 1);
    const maxAge = Math.ceil(Math.max(...data.map(d => d.age)) + 1);
    const minProd = Math.floor(Math.min(...data.map(d => d.production)) * 0.9);
    const maxProd = Math.ceil(Math.max(...data.map(d => d.production)) * 1.05);

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-white flex items-center gap-2">
                        <span className="text-xl">🌍</span> Dynasty Landscape
                    </CardTitle>
                    <p className="text-xs text-slate-400">Competitive Window Analysis (Age vs Production)</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">{useMaxPf ? 'Max PF' : 'PPG'}</span>
                    <Switch checked={useMaxPf} onCheckedChange={setUseMaxPf} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />

                            {/* X-Axis: Age */}
                            <XAxis
                                type="number"
                                dataKey="age"
                                name="Average Age"
                                domain={[minAge, maxAge]}
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8' }}
                            >
                                <Label value="Average Age (Years)" offset={0} position="insideBottom" fill="#64748b" dy={10} />
                            </XAxis>

                            {/* Y-Axis: Production */}
                            <YAxis
                                type="number"
                                dataKey="production"
                                name="Production"
                                domain={[minProd, maxProd]}
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8' }}
                                width={30}
                            />

                            {/* Tooltip */}
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

                            {/* Quadrant Lines (Averages) */}
                            <ReferenceLine x={averages.age} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} />
                            <ReferenceLine y={averages.production} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} />

                            {/* Quadrant Labels (Fixed Positions approximating corners) */}
                            {/* Note: In responsive container, fixed percent/pixels are tricky for Labels on ReferenceLine. 
                                We'll assume the user can infer quadrants or use background/annotations if we want to be fancy.
                                For now, the Tooltip provides the classification.
                            */}

                            {/* Data Points */}
                            <Scatter name="Teams" data={data} shape={<CustomNode />} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 text-center text-xs text-slate-400">
                    <div className="p-2 bg-slate-900/50 rounded border border-slate-800">
                        <span className="text-green-400 font-bold block">Top Left</span>
                        Dynasty Kings <br />(Young & Good)
                    </div>
                    <div className="p-2 bg-slate-900/50 rounded border border-slate-800">
                        <span className="text-blue-400 font-bold block">Top Right</span>
                        Contenders <br />(Old & Good)
                    </div>
                    <div className="p-2 bg-slate-900/50 rounded border border-slate-800">
                        <span className="text-yellow-400 font-bold block">Bottom Left</span>
                        Rebuilders <br />(Young & Bad)
                    </div>
                    <div className="p-2 bg-slate-900/50 rounded border border-slate-800">
                        <span className="text-red-400 font-bold block">Bottom Right</span>
                        Danger Zone <br />(Old & Bad)
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DynastyLandscape;
