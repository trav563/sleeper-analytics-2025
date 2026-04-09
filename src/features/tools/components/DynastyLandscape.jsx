import { useMemo, useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Label } from 'recharts';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Switch';
import { fetchLeagueRosters } from '../../../utils/sleeper';

const DynastyLandscape = ({ rosters, users, players, league, state }) => {
    const [useMaxPf, setUseMaxPf] = useState(false);
    const [prevSeasonRosters, setPrevSeasonRosters] = useState(null);
    const [usingPrevSeason, setUsingPrevSeason] = useState(false);

    // Check if current season has any points data
    const hasCurrentSeasonData = useMemo(() => {
        if (!rosters) return false;
        return rosters.some(r => (r.settings?.fpts || 0) > 0);
    }, [rosters]);

    // Fetch previous season rosters if current season has no data
    useEffect(() => {
        if (hasCurrentSeasonData || !league?.previous_league_id) {
            setUsingPrevSeason(false);
            return;
        }
        let cancelled = false;
        fetchLeagueRosters(league.previous_league_id).then(data => {
            if (!cancelled && data) {
                setPrevSeasonRosters(data);
                setUsingPrevSeason(true);
            }
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [hasCurrentSeasonData, league?.previous_league_id]);

    // Use previous season rosters for PPG when current season has no data
    const effectiveRosters = usingPrevSeason && prevSeasonRosters ? prevSeasonRosters : rosters;

    const data = useMemo(() => {
        if (!rosters || !users || !players || !league) return [];

        const currentLeg = state?.leg || 1;

        const teams = rosters.map(roster => {
            const owner = users.find(u => u.user_id === roster.owner_id);

            // Find the matching roster from effective data for PPG calculation
            const ppgRoster = usingPrevSeason
                ? effectiveRosters?.find(r => r.owner_id === roster.owner_id) || roster
                : roster;

            // Calculate games played from the effective roster's record
            let gamesPlayed;
            if (usingPrevSeason) {
                const totalRecord = (ppgRoster.settings?.wins || 0) + (ppgRoster.settings?.losses || 0) + (ppgRoster.settings?.ties || 0);
                gamesPlayed = Math.max(1, totalRecord > 18 ? totalRecord / 2 : totalRecord);
            } else {
                gamesPlayed = Math.max(1, currentLeg - 1);
            }

            const ppg = ((ppgRoster.settings?.fpts || 0) + (ppgRoster.settings?.fpts_decimal || 0) / 100) / gamesPlayed;
            const maxPf = (ppgRoster.settings?.ppts || 0) + (ppgRoster.settings?.ppts_decimal || 0) / 100;
            const productionMetric = useMaxPf ? maxPf : ppg;

            // 2. Calculate Average Age (X-Axis)
            const validPlayers = (roster.players || [])
                .map(id => players[id])
                .filter(p => p && ['QB', 'RB', 'WR', 'TE'].includes(p.position) && p.age);

            const totalAge = validPlayers.reduce((sum, p) => sum + (p.age || 0), 0);
            const avgAge = validPlayers.length > 0 ? totalAge / validPlayers.length : 0;

            return {
                rosterId: roster.roster_id,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar),
                age: parseFloat(avgAge.toFixed(1)),
                production: parseFloat(productionMetric.toFixed(1)),
                productionLabel: useMaxPf ? 'Max PF' : 'PPG',
            };
        });

        return teams.filter(t => t.age > 0);
    }, [rosters, users, players, league, state, useMaxPf, usingPrevSeason, effectiveRosters]);

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

    // Custom Scatter Point (Avatar) - Larger for mobile touch
    const CustomNode = (props) => {
        const { cx, cy, payload } = props;
        return (
            <foreignObject x={cx - 20} y={cy - 20} width={40} height={40}>
                <img
                    src={payload.avatar}
                    alt={payload.name}
                    className="w-[40px] h-[40px] rounded-full border-2 border-white/20 hover:scale-125 transition-transform cursor-pointer shadow-lg bg-slate-800"
                    title={payload.name}
                />
            </foreignObject>
        );
    };

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;

            // Classify based on new quadrants
            let classification = "";
            // Top-Left (Young & High Prod) -> Dynasty King
            if (data.production >= averages.production && data.age <= averages.age) classification = "👑 Dynasty King";
            // Top-Right (Old & High Prod) -> Contender
            else if (data.production >= averages.production && data.age > averages.age) classification = "🏆 Contender";
            // Bottom-Left (Young & Low Prod) -> Rebuilder
            else if (data.production < averages.production && data.age <= averages.age) classification = "🛠️ Rebuilder";
            // Bottom-Right (Old & Low Prod) -> Danger Zone
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
                        <div className="pt-2 mt-1 border-t border-slate-800 text-center font-bold text-white">
                            {classification}
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!data || data.length === 0) return null;

    // Axis Domains padding
    const minAge = Math.floor(Math.min(...data.map(d => d.age)) - 0.5);
    const maxAge = Math.ceil(Math.max(...data.map(d => d.age)) + 0.5);
    const minProd = Math.floor(Math.min(...data.map(d => d.production)) * 0.95);
    const maxProd = Math.ceil(Math.max(...data.map(d => d.production)) * 1.05);

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <div>
                    <CardTitle className="text-white flex items-center gap-2 text-lg sm:text-xl">
                        <span className="text-xl">🌍</span> <span className="hidden sm:inline">Dynasty Landscape</span><span className="sm:hidden">Landscape</span>
                    </CardTitle>
                    <p className="text-[10px] sm:text-xs text-slate-400">
                        Competitive Window (Age vs Prod)
                        {usingPrevSeason && <span className="text-amber-400 ml-1">— Using {parseInt(state?.season || '2026') - 1} season data</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-medium text-slate-400">{useMaxPf ? 'Max PF' : 'PPG'}</span>
                    <Switch checked={useMaxPf} onCheckedChange={setUseMaxPf} className="scale-75 sm:scale-100" />
                </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
                {/* Fixed height container for consistent mobile view */}
                <div className="h-[500px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />

                            {/* Color Quadrants based on Averages */}
                            {/* Top-Left: Young (minAge to avgAge) & Good (avgProd to maxProd) */}
                            <ReferenceArea x1={minAge} x2={averages.age} y1={averages.production} y2={maxProd} fill="#4ade80" fillOpacity={0.05} />
                            {/* Top-Right: Old (avgAge to maxAge) & Good (avgProd to maxProd) */}
                            <ReferenceArea x1={averages.age} x2={maxAge} y1={averages.production} y2={maxProd} fill="#facc15" fillOpacity={0.05} />
                            {/* Bottom-Left: Young (minAge to avgAge) & Bad (minProd to avgProd) */}
                            <ReferenceArea x1={minAge} x2={averages.age} y1={minProd} y2={averages.production} fill="#60a5fa" fillOpacity={0.05} />
                            {/* Bottom-Right: Old (avgAge to maxAge) & Bad (minProd to avgProd) */}
                            <ReferenceArea x1={averages.age} x2={maxAge} y1={minProd} y2={averages.production} fill="#f87171" fillOpacity={0.05} />

                            <XAxis
                                type="number"
                                dataKey="age"
                                name="Average Age"
                                domain={[minAge, maxAge]}
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickCount={5}
                            >
                                <Label value="Average Age" offset={-10} position="insideBottom" fill="#64748b" style={{ fontSize: '10px' }} />
                            </XAxis>

                            <YAxis
                                type="number"
                                dataKey="production"
                                name="Production"
                                domain={[minProd, maxProd]}
                                stroke="#94a3b8"
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                width={30}
                            />

                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

                            {/* Center Lines */}
                            <ReferenceLine x={averages.age} stroke="#94a3b8" strokeDasharray="3 3" />
                            <ReferenceLine y={averages.production} stroke="#94a3b8" strokeDasharray="3 3" />

                            <Scatter name="Teams" data={data} shape={<CustomNode />} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend / Key */}
                <div className="grid grid-cols-2 gap-2 mt-4 px-4 pb-4 sm:px-0 sm:pb-0">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-400/20 border border-green-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Dynasty King</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-400/20 border border-yellow-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Contender</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-400/20 border border-blue-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Rebuilder</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400/20 border border-red-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Danger Zone</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DynastyLandscape;
