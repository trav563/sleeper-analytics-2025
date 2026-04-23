import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useSeasonMatchups } from '../hooks/useSeasonMatchups';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Crown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Pip } from '../../../components/ui/Pip';
import { theme } from '../../../lib/theme';

const PowerRankings = ({ leagueId, currentWeek, rosters, users }) => {
    const { seasonMatchups, loading } = useSeasonMatchups(leagueId, currentWeek);

    const rankings = useMemo(() => {
        if (loading || !rosters || !seasonMatchups || Object.keys(seasonMatchups).length === 0) return [];

        const numTeams = rosters.length;

        const weeklyRankings = {}; // { rosterId: [rank_w1, rank_w2, ...] }
        rosters.forEach(r => { weeklyRankings[r.roster_id] = []; });

        const weeksPlayed = Object.keys(seasonMatchups).map(Number).sort((a, b) => a - b);
        if (weeksPlayed.length === 0) return [];

        for (let upToWeek = 1; upToWeek <= weeksPlayed[weeksPlayed.length - 1]; upToWeek++) {
            const teamScores = {};

            rosters.forEach(r => {
                teamScores[r.roster_id] = {
                    rosterId: r.roster_id,
                    wins: 0, losses: 0, ties: 0,
                    totalPoints: 0, gamesPlayed: 0,
                    allPlayWins: 0, allPlayLosses: 0,
                    opponentPoints: 0,
                };
            });

            for (let w = 1; w <= upToWeek; w++) {
                const weekData = seasonMatchups[w];
                if (!weekData) continue;

                const allScores = weekData.map(m => ({ rosterId: m.roster_id, points: m.points || 0 }));

                const matchGroups = {};
                weekData.forEach(m => {
                    if (!matchGroups[m.matchup_id]) matchGroups[m.matchup_id] = [];
                    matchGroups[m.matchup_id].push(m);
                });

                Object.values(matchGroups).forEach(group => {
                    if (group.length !== 2) return;
                    const [t1, t2] = group;
                    if (t1.points > t2.points) {
                        if (teamScores[t1.roster_id]) teamScores[t1.roster_id].wins++;
                        if (teamScores[t2.roster_id]) teamScores[t2.roster_id].losses++;
                    } else if (t2.points > t1.points) {
                        if (teamScores[t2.roster_id]) teamScores[t2.roster_id].wins++;
                        if (teamScores[t1.roster_id]) teamScores[t1.roster_id].losses++;
                    } else {
                        if (teamScores[t1.roster_id]) teamScores[t1.roster_id].ties++;
                        if (teamScores[t2.roster_id]) teamScores[t2.roster_id].ties++;
                    }

                    if (teamScores[t1.roster_id]) teamScores[t1.roster_id].opponentPoints += t2.points || 0;
                    if (teamScores[t2.roster_id]) teamScores[t2.roster_id].opponentPoints += t1.points || 0;
                });

                allScores.forEach(({ rosterId, points }) => {
                    if (teamScores[rosterId] && points > 0) {
                        teamScores[rosterId].totalPoints += points;
                        teamScores[rosterId].gamesPlayed++;
                    }
                });

                allScores.forEach(teamA => {
                    allScores.forEach(teamB => {
                        if (teamA.rosterId === teamB.rosterId) return;
                        if (teamA.points > teamB.points && teamScores[teamA.rosterId]) {
                            teamScores[teamA.rosterId].allPlayWins++;
                        } else if (teamA.points < teamB.points && teamScores[teamA.rosterId]) {
                            teamScores[teamA.rosterId].allPlayLosses++;
                        }
                    });
                });
            }

            const scores = Object.values(teamScores).map(t => {
                const gp = t.gamesPlayed || 1;
                const totalGames = t.wins + t.losses + t.ties || 1;
                const winPct = (t.wins + t.ties * 0.5) / totalGames;
                const ppg = t.totalPoints / gp;
                const apTotal = t.allPlayWins + t.allPlayLosses || 1;
                const apWinPct = t.allPlayWins / apTotal;
                const sos = t.opponentPoints / gp;

                return { ...t, winPct, ppg, apWinPct, sos };
            });

            const normalize = (arr, key) => {
                const vals = arr.map(a => a[key]);
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const range = max - min || 1;
                return arr.map(a => ({ ...a, [`${key}Norm`]: (a[key] - min) / range }));
            };

            let ranked = scores;
            ranked = normalize(ranked, 'winPct');
            ranked = normalize(ranked, 'ppg');
            ranked = normalize(ranked, 'apWinPct');
            ranked = normalize(ranked, 'sos');

            ranked.forEach(t => {
                t.composite = (t.winPctNorm * 0.25 + t.ppgNorm * 0.25 + t.apWinPctNorm * 0.25 + t.sosNorm * 0.25) * 100;
            });

            ranked.sort((a, b) => b.composite - a.composite || b.totalPoints - a.totalPoints);
            ranked.forEach((t, i) => {
                weeklyRankings[t.rosterId].push(i + 1);
            });
        }

        const latestWeek = weeksPlayed[weeksPlayed.length - 1];
        const finalScores = {};

        rosters.forEach(r => {
            finalScores[r.roster_id] = {
                rosterId: r.roster_id,
                wins: 0, losses: 0, totalPoints: 0, gamesPlayed: 0,
                allPlayWins: 0, allPlayLosses: 0, opponentPoints: 0,
            };
        });

        for (let w = 1; w <= latestWeek; w++) {
            const weekData = seasonMatchups[w];
            if (!weekData) continue;
            const allScores = weekData.map(m => ({ rosterId: m.roster_id, points: m.points || 0 }));

            const matchGroups = {};
            weekData.forEach(m => {
                if (!matchGroups[m.matchup_id]) matchGroups[m.matchup_id] = [];
                matchGroups[m.matchup_id].push(m);
            });
            Object.values(matchGroups).forEach(group => {
                if (group.length !== 2) return;
                const [t1, t2] = group;
                if (t1.points > t2.points) { if (finalScores[t1.roster_id]) finalScores[t1.roster_id].wins++; if (finalScores[t2.roster_id]) finalScores[t2.roster_id].losses++; }
                else if (t2.points > t1.points) { if (finalScores[t2.roster_id]) finalScores[t2.roster_id].wins++; if (finalScores[t1.roster_id]) finalScores[t1.roster_id].losses++; }
                if (finalScores[t1.roster_id]) finalScores[t1.roster_id].opponentPoints += t2.points || 0;
                if (finalScores[t2.roster_id]) finalScores[t2.roster_id].opponentPoints += t1.points || 0;
            });
            allScores.forEach(({ rosterId, points }) => {
                if (finalScores[rosterId] && points > 0) { finalScores[rosterId].totalPoints += points; finalScores[rosterId].gamesPlayed++; }
            });
            allScores.forEach(teamA => {
                allScores.forEach(teamB => {
                    if (teamA.rosterId === teamB.rosterId) return;
                    if (teamA.points > teamB.points && finalScores[teamA.rosterId]) finalScores[teamA.rosterId].allPlayWins++;
                });
            });
        }

        return Object.values(finalScores).map(t => {
            const gp = t.gamesPlayed || 1;
            const totalGames = t.wins + t.losses || 1;
            const winPct = (t.wins) / totalGames;
            const ppg = t.totalPoints / gp;
            const apTotal = t.allPlayWins + t.allPlayLosses || 1;
            const apWinPct = t.allPlayWins / apTotal;
            const sos = t.opponentPoints / gp;

            const owner = users?.find(u => u.user_id === rosters.find(r => r.roster_id === t.rosterId)?.owner_id);
            const trend = weeklyRankings[t.rosterId] || [];
            const currentRank = trend.length > 0 ? trend[trend.length - 1] : numTeams;
            const prevRank = trend.length > 1 ? trend[trend.length - 2] : currentRank;
            const rankChange = prevRank - currentRank;

            return {
                rosterId: t.rosterId,
                ownerId: owner?.user_id,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar),
                record: `${t.wins}-${t.losses}`,
                ppg: ppg.toFixed(1),
                apWinPct: (apWinPct * 100).toFixed(0),
                sos: sos.toFixed(1),
                trend: trend.map((rank, i) => ({ week: i + 1, rank })),
                currentRank,
                rankChange,
            };
        }).sort((a, b) => a.currentRank - b.currentRank);
    }, [seasonMatchups, rosters, users, loading]);

    if (loading) return (
        <section className="bg-bg-1 rounded-xl border border-line p-6 shadow-card">
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute text-center">
                Loading Power Rankings…
            </div>
        </section>
    );

    if (!rankings || rankings.length === 0) return (
        <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card">
            <header className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-signal" aria-hidden="true" />
                <h3 className="font-display text-lg font-semibold text-text">Power Rankings</h3>
            </header>
            <p className="text-sm text-text-dim">
                Power Rankings will appear once the season starts and matchup data is available.
            </p>
        </section>
    );

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-text">Power Rankings</h3>
                </div>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    Composite · Win% · PPG · All-Play% · SoS
                </p>
            </header>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2">
                            <th className="px-3 py-2.5 w-10 text-center">#</th>
                            <th className="px-3 py-2.5">Team</th>
                            <th className="px-3 py-2.5 text-center hidden sm:table-cell">Record</th>
                            <th className="px-3 py-2.5 text-center hidden sm:table-cell">PPG</th>
                            <th className="px-3 py-2.5 text-center hidden md:table-cell">AP W%</th>
                            <th className="px-3 py-2.5 text-center hidden md:table-cell">SoS</th>
                            <th className="px-3 py-2.5 text-center w-20">Trend</th>
                            <th className="px-3 py-2.5 text-center w-12">Move</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rankings.map((team, idx) => {
                            const rankColor = idx === 0 ? 'text-signal' : idx <= 2 ? 'text-text' : 'text-text-mute';
                            const trendStroke = team.rankChange > 0
                                ? theme.color.good
                                : team.rankChange < 0 ? theme.color.bad : theme.color.textMute;
                            return (
                                <tr key={team.rosterId} className="border-b border-line hover:bg-bg-2/60 transition-colors duration-fast">
                                    <td className={`px-3 py-3 tnum font-bold text-center ${rankColor}`}>
                                        {idx + 1}
                                    </td>
                                    <td className="px-3 py-3 text-text">
                                        <div className="flex items-center gap-2">
                                            {team.avatar ? (
                                                <img src={team.avatar} alt="" className="w-7 h-7 rounded-full ring-1 ring-line shrink-0" />
                                            ) : (
                                                <Pip seed={team.ownerId ?? team.rosterId} name={team.name} size={28} />
                                            )}
                                            <span className="text-sm font-semibold truncate max-w-[160px] sm:max-w-none">{team.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-center tnum text-text-dim hidden sm:table-cell">{team.record}</td>
                                    <td className="px-3 py-3 text-center tnum text-text-dim hidden sm:table-cell">{team.ppg}</td>
                                    <td className="px-3 py-3 text-center tnum text-text-dim hidden md:table-cell">{team.apWinPct}%</td>
                                    <td className="px-3 py-3 text-center tnum text-text-dim hidden md:table-cell">{team.sos}</td>
                                    <td className="px-3 py-3">
                                        {team.trend.length > 1 ? (
                                            <div className="h-6 w-16 mx-auto">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={team.trend}>
                                                        <Line
                                                            type="monotone"
                                                            dataKey="rank"
                                                            stroke={trendStroke}
                                                            strokeWidth={1.5}
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-text-mute block text-center">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        {team.rankChange > 0 ? (
                                            <span className="text-good text-xs font-mono tnum font-semibold inline-flex items-center justify-center gap-0.5">
                                                <TrendingUp className="w-3 h-3" /> {team.rankChange}
                                            </span>
                                        ) : team.rankChange < 0 ? (
                                            <span className="text-bad text-xs font-mono tnum font-semibold inline-flex items-center justify-center gap-0.5">
                                                <TrendingDown className="w-3 h-3" /> {Math.abs(team.rankChange)}
                                            </span>
                                        ) : (
                                            <span className="text-text-mute inline-flex items-center justify-center">
                                                <Minus className="w-3 h-3" />
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default PowerRankings;
