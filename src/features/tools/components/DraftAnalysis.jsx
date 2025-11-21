import { useState, useEffect, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchDraftPicks } from '../../../utils/sleeper';
import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { usePlayerStats } from '../hooks/usePlayerStats';

const DraftAnalysis = ({ league, currentWeek, players }) => {
    const [picks, setPicks] = useState([]);
    const [loadingDraft, setLoadingDraft] = useState(false);
    const { seasonMatchups, loading: loadingMatchups } = useSeasonMatchups(league?.league_id, currentWeek);
    const playerStats = usePlayerStats(seasonMatchups);

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

    const data = useMemo(() => {
        if (!picks || !playerStats || !players) return [];

        return picks.map(pick => {
            const pid = pick.player_id;
            const stat = playerStats[pid];
            const player = players[pid];

            if (!stat || !player) return null;

            // Determine Steal/Bust
            // Simple logic: 
            // Steal: Pick > 100 AND Points > 100 (Arbitrary, but let's make it dynamic later)
            // Bust: Pick < 50 AND Points < 50
            // Let's use the prompt's logic: "Highlight 'Steals' (Late pick, High points) in Green and 'Busts' (Early pick, Low points) in Red."

            const isSteal = pick.pick_no > 100 && stat.totalPoints > 100;
            const isBust = pick.pick_no < 50 && stat.totalPoints < 50;

            return {
                pickNo: pick.pick_no,
                points: stat.totalPoints,
                name: `${player.first_name} ${player.last_name}`,
                position: player.position,
                isSteal,
                isBust
            };
        }).filter(Boolean);

    }, [picks, playerStats, players]);

    if (loadingDraft || loadingMatchups) return <div className="p-8 text-center text-gray-400">Loading Draft Analysis...</div>;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg text-xs">
                    <p className="font-bold text-white">{data.name} ({data.position})</p>
                    <p className="text-slate-400">Pick: {data.pickNo}</p>
                    <p className="text-slate-400">Points: {data.points.toFixed(1)}</p>
                    {data.isSteal && <p className="text-green-400 font-bold">STEAL!</p>}
                    {data.isBust && <p className="text-red-400 font-bold">BUST!</p>}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Draft ROI</h3>
            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis type="number" dataKey="pickNo" name="Pick" unit="" stroke="#94a3b8" label={{ value: 'Pick Number', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                        <YAxis type="number" dataKey="points" name="Points" unit="" stroke="#94a3b8" label={{ value: 'Total Points', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Players" data={data} fill="#8884d8">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.isSteal ? '#4ade80' : entry.isBust ? '#f87171' : '#94a3b8'} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DraftAnalysis;
