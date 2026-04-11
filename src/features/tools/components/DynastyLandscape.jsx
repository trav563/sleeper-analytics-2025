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

            const ppgRoster = usingPrevSeason
                ? effectiveRosters?.find(r => r.owner_id === roster.owner_id) || roster
                : roster;

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

    // Calculate dynasty score for best/worst highlighting
    const { bestId, worstId } = useMemo(() => {
        if (data.length === 0) return { bestId: null, worstId: null };

        const ages = data.map(d => d.age);
        const prods = data.map(d => d.production);
        const minAge = Math.min(...ages);
        const maxAge = Math.max(...ages);
        const minProd = Math.min(...prods);
        const maxProd = Math.max(...prods);
        const ageRange = maxAge - minAge || 1;
        const prodRange = maxProd - minProd || 1;

        let best = null, worst = null;
        let bestScore = -Infinity, worstScore = Infinity;

        data.forEach(team => {
            const normProd = (team.production - minProd) / prodRange; // 0-1, higher is better
            const normAge = (team.age - minAge) / ageRange; // 0-1, lower is better
            const score = (normProd * 0.6) + ((1 - normAge) * 0.4);

            if (score > bestScore) { bestScore = score; best = team.rosterId; }
            if (score < worstScore) { worstScore = score; worst = team.rosterId; }
        });

        return { bestId: best, worstId: worst };
    }, [data]);

    // Enrich data with best/worst flags
    const enrichedData = useMemo(() => {
        return data.map(d => ({
            ...d,
            isBest: d.rosterId === bestId,
            isWorst: d.rosterId === worstId,
        }));
    }, [data, bestId, worstId]);

    // Custom Scatter Point (Avatar) with highlight for best/worst
    const CustomNode = (props) => {
        const { cx, cy, payload } = props;
        let borderClass = 'border-2 border-white/20';
        let shadowClass = '';
        if (payload.isBest) {
            borderClass = 'border-3 border-yellow-400';
            shadowClass = 'shadow-[0_0_12px_rgba(250,204,21,0.5)]';
        } else if (payload.isWorst) {
            borderClass = 'border-3 border-red-400';
            shadowClass = 'shadow-[0_0_12px_rgba(248,113,113,0.5)]';
        }
        return (
            <foreignObject x={cx - 20} y={cy - 20} width={40} height={40}>
                <img
                    src={payload.avatar}
                    alt={payload.name}
                    className={`w-[40px] h-[40px] rounded-full ${borderClass} ${shadowClass} hover:scale-125 transition-transform cursor-pointer bg-slate-800`}
                    title={payload.name}
                />
            </foreignObject>
        );
    };

    // Custom Tooltip with updated labels
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;

            let classification = '';
            if (d.production >= averages.production && d.age <= averages.age) classification = '🏆 Dynasty Elite';
            else if (d.production >= averages.production && d.age > averages.age) classification = '⏳ Win-Now';
            else if (d.production < averages.production && d.age <= averages.age) classification = '🛠️ Rebuilder';
            else classification = '⚠️ Danger Zone';

            let highlight = '';
            if (d.isBest) highlight = '👑 Dynasty King';
            else if (d.isWorst) highlight = '💀 Cellar Dweller';

            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
                    <p className="font-bold text-white mb-1">{d.name}</p>
                    <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex justify-between gap-4">
                            <span>Avg Age:</span>
                            <span className="font-mono text-white">{d.age} yrs</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span>{d.productionLabel}:</span>
                            <span className={`font-mono font-bold ${d.production >= averages.production ? 'text-green-400' : 'text-red-400'}`}>
                                {d.production}
                            </span>
                        </div>
                        <div className="pt-2 mt-1 border-t border-slate-800 text-center font-bold text-white">
                            {classification}
                        </div>
                        {highlight && (
                            <div className={`text-center font-bold text-sm ${d.isBest ? 'text-yellow-400' : 'text-red-400'}`}>
                                {highlight}
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!enrichedData || enrichedData.length === 0) return null;

    // Axis Domains padding
    const minAge = Math.floor(Math.min(...enrichedData.map(d => d.age)) - 0.5);
    const maxAge = Math.ceil(Math.max(...enrichedData.map(d => d.age)) + 0.5);
    const minProd = Math.floor(Math.min(...enrichedData.map(d => d.production)) * 0.95);
    const maxProd = Math.ceil(Math.max(...enrichedData.map(d => d.production)) * 1.05);

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
                <div className="h-[500px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />

                            {/* Color Quadrants */}
                            <ReferenceArea x1={minAge} x2={averages.age} y1={averages.production} y2={maxProd} fill="#4ade80" fillOpacity={0.05} />
                            <ReferenceArea x1={averages.age} x2={maxAge} y1={averages.production} y2={maxProd} fill="#facc15" fillOpacity={0.05} />
                            <ReferenceArea x1={minAge} x2={averages.age} y1={minProd} y2={averages.production} fill="#60a5fa" fillOpacity={0.05} />
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

                            <ReferenceLine x={averages.age} stroke="#94a3b8" strokeDasharray="3 3" />
                            <ReferenceLine y={averages.production} stroke="#94a3b8" strokeDasharray="3 3" />

                            <Scatter name="Teams" data={enrichedData} shape={<CustomNode />} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 mt-4 px-4 pb-4 sm:px-0 sm:pb-0">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-400/20 border border-green-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Dynasty Elite</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-400/20 border border-yellow-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Win-Now</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-400/20 border border-blue-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Rebuilder</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400/20 border border-red-400"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400">Danger Zone</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-400/40 border-2 border-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]"></div>
                        <span className="text-[10px] sm:text-xs text-yellow-400 font-medium">Dynasty King</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400/40 border-2 border-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"></div>
                        <span className="text-[10px] sm:text-xs text-red-400 font-medium">Cellar Dweller</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DynastyLandscape;
