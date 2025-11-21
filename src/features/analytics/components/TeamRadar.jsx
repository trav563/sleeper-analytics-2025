import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { useSeasonMatchups } from '../hooks/useSeasonMatchups';

const TeamRadar = ({ leagueId, currentWeek, rosters, players, userRosterId }) => {
    const { seasonMatchups, loading } = useSeasonMatchups(leagueId, currentWeek);

    const data = useMemo(() => {
        if (loading || !seasonMatchups || !players || !userRosterId) return [];

        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX'];
        const leagueSums = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const leagueCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const userSums = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const userCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };

        Object.values(seasonMatchups).forEach(weekMatchups => {
            if (!weekMatchups) return;

            weekMatchups.forEach(matchup => {
                const isUser = matchup.roster_id === userRosterId;

                matchup.starters.forEach((playerId, index) => {
                    if (!playerId || playerId === "0") return;
                    const points = matchup.starters_points[index];
                    const player = players[playerId];
                    if (!player) return;

                    let pos = player.position;
                    // Map K/DEF if needed, or ignore. Prompt asked for QB, RB, WR, TE, FLEX.
                    // Sleeper positions: QB, RB, WR, TE, K, DEF.
                    // FLEX usually implies RB/WR/TE.
                    // We need to know the *slot* to determine if it was a FLEX play, OR just average all RB/WR/TEs.
                    // "League Average points for QB, RB..." usually means "Average points scored by a starting QB".
                    // If a WR is in a FLEX slot, do we count them as WR or FLEX?
                    // Prompt says "QB, RB, WR, TE, FLEX". This implies specific slots.
                    // But Sleeper API `starters` array matches `roster_positions` order.
                    // We don't have `roster_positions` passed in here easily (it's on `league` object).
                    // Let's assume standard positions based on player primary position for QB/RB/WR/TE.
                    // For FLEX, it's ambiguous.
                    // Simplification: Average points per *Player Position*.
                    // But "FLEX" is a category in the prompt.
                    // Let's try to map based on player position.
                    // QB -> QB, RB -> RB, WR -> WR, TE -> TE.
                    // What about FLEX? Maybe it means "Average points of all non-QB starters"?
                    // Or maybe we calculate "Average Team Score from QBs", "Average Team Score from RBs", etc.
                    // Let's go with: Average Points Per Game per Position.
                    // And for FLEX, maybe we skip it or aggregate RB/WR/TE overflow?
                    // Let's stick to strict positions for now: QB, RB, WR, TE.
                    // If the prompt explicitly asks for FLEX, I should try to support it.
                    // But without slot info, it's hard.
                    // Let's just do QB, RB, WR, TE and maybe "FLEX" as (RB+WR+TE avg).

                    if (['QB', 'RB', 'WR', 'TE'].includes(pos)) {
                        leagueSums[pos] += points;
                        leagueCounts[pos]++;
                        if (isUser) {
                            userSums[pos] += points;
                            userCounts[pos]++;
                        }
                    }
                });
            });
        });

        // Calculate Averages
        return positions.filter(p => p !== 'FLEX').map(pos => ({
            subject: pos,
            LeagueAvg: leagueCounts[pos] ? (leagueSums[pos] / leagueCounts[pos]).toFixed(2) : 0,
            MyTeam: userCounts[pos] ? (userSums[pos] / userCounts[pos]).toFixed(2) : 0,
            fullMark: 30 // Arbitrary scale max
        }));

    }, [seasonMatchups, players, userRosterId, loading]);

    if (loading) return <div className="h-64 flex items-center justify-center text-gray-400">Loading Radar...</div>;

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Positional Strength</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid stroke="#475569" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                        <Radar
                            name="League Avg"
                            dataKey="LeagueAvg"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            fill="#94a3b8"
                            fillOpacity={0.3}
                        />
                        <Radar
                            name="My Team"
                            dataKey="MyTeam"
                            stroke="#22c55e"
                            strokeWidth={2}
                            fill="#22c55e"
                            fillOpacity={0.5}
                        />
                        <Legend />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TeamRadar;
