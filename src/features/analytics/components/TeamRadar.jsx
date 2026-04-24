import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useSeasonMatchups } from '../hooks/useSeasonMatchups';
import { displayTeamName } from '../../../utils/nflData';
import { theme } from '../../../lib/theme';

const TeamRadar = ({ leagueId, currentWeek, rosters, players, userRosterId, users, opponentRosterId, opponentTeamName, headerExtras }) => {
    const { seasonMatchups, loading } = useSeasonMatchups(leagueId, currentWeek);

    const selectedTeamName = useMemo(() => {
        if (!rosters || !userRosterId) return 'Selected Team';
        const roster = rosters.find(r => r.roster_id === userRosterId);
        if (!roster) return 'Selected Team';
        const user = users?.find(u => u.user_id === roster.owner_id);
        return displayTeamName(user);
    }, [rosters, userRosterId, users]);

    const data = useMemo(() => {
        if (loading || !seasonMatchups || !players || !userRosterId) return [];

        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX'];
        const leagueSums = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const leagueCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const userSums = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const userCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const opponentSums = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
        const opponentCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };

        Object.values(seasonMatchups).forEach(weekMatchups => {
            if (!weekMatchups) return;

            weekMatchups.forEach(matchup => {
                const isUser = matchup.roster_id === userRosterId;
                const isOpponent = opponentRosterId && matchup.roster_id === opponentRosterId;

                matchup.starters.forEach((playerId, index) => {
                    if (!playerId || playerId === "0") return;
                    const points = matchup.starters_points[index];
                    const player = players[playerId];
                    if (!player) return;

                    let pos = player.position;

                    if (['QB', 'RB', 'WR', 'TE'].includes(pos)) {
                        leagueSums[pos] += points;
                        leagueCounts[pos]++;
                        if (isUser) {
                            userSums[pos] += points;
                            userCounts[pos]++;
                        }
                        if (isOpponent) {
                            opponentSums[pos] += points;
                            opponentCounts[pos]++;
                        }
                    }
                });
            });
        });

        return positions.filter(p => p !== 'FLEX').map(pos => {
            const item = {
                subject: pos,
                [selectedTeamName]: userCounts[pos] ? Number((userSums[pos] / userCounts[pos]).toFixed(2)) : 0,
                fullMark: 30
            };

            if (opponentRosterId) {
                item[opponentTeamName] = opponentCounts[pos] ? Number((opponentSums[pos] / opponentCounts[pos]).toFixed(2)) : 0;
            } else {
                item['LeagueAvg'] = leagueCounts[pos] ? Number((leagueSums[pos] / leagueCounts[pos]).toFixed(2)) : 0;
            }

            return item;
        });
    }, [seasonMatchups, players, userRosterId, opponentRosterId, loading, selectedTeamName, opponentTeamName]);

    const Frame = ({ children }) => (
        <section className="bg-bg-1 rounded-xl border border-line p-4 shadow-card">
            <header className="mb-3">
                <h3 className="font-display text-lg font-semibold text-text">Positional Strength</h3>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-0.5">
                    Avg starter points by position
                </p>
                {headerExtras && (
                    <div className="mt-3 pt-3 border-t border-line">
                        {headerExtras}
                    </div>
                )}
            </header>
            {children}
        </section>
    );

    if (loading) return (
        <Frame>
            <div className="h-64 flex items-center justify-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                Loading radar…
            </div>
        </Frame>
    );
    if (!players) return (
        <Frame>
            <div className="h-64 flex items-center justify-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                Loading player database…
            </div>
        </Frame>
    );
    if (!seasonMatchups || Object.keys(seasonMatchups).length === 0) return (
        <Frame>
            <div className="h-64 flex items-center justify-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                No matchup data available
            </div>
        </Frame>
    );

    return (
        <Frame>
            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="78%" data={data} margin={{ top: 0, right: 0, bottom: 30, left: 0 }}>
                        <PolarGrid stroke={theme.color.lineStrong} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: theme.color.textDim, fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: theme.color.bg1,
                                border: `1px solid ${theme.color.lineStrong}`,
                                borderRadius: theme.radius.md,
                                color: theme.color.text,
                                fontFamily: 'var(--font-sans)',
                                fontSize: 12,
                            }}
                            itemStyle={{ color: theme.color.text }}
                            cursor={{ stroke: theme.color.lineStrong }}
                        />

                        {opponentRosterId ? (
                            <>
                                <Radar
                                    name={selectedTeamName}
                                    dataKey={selectedTeamName}
                                    stroke={theme.color.signal}
                                    strokeWidth={2}
                                    fill={theme.color.signal}
                                    fillOpacity={0.4}
                                />
                                <Radar
                                    name={opponentTeamName}
                                    dataKey={opponentTeamName}
                                    stroke={theme.color.bad}
                                    strokeWidth={2}
                                    fill={theme.color.bad}
                                    fillOpacity={0.35}
                                />
                            </>
                        ) : (
                            <>
                                <Radar
                                    name="League Avg"
                                    dataKey="LeagueAvg"
                                    stroke={theme.color.textDim}
                                    strokeWidth={1.5}
                                    fill={theme.color.textDim}
                                    fillOpacity={0.18}
                                />
                                <Radar
                                    name={selectedTeamName}
                                    dataKey={selectedTeamName}
                                    stroke={theme.color.signal}
                                    strokeWidth={2}
                                    fill={theme.color.signal}
                                    fillOpacity={0.4}
                                />
                            </>
                        )}
                        <Legend
                            wrapperStyle={{
                                color: theme.color.textDim,
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                            }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </Frame>
    );
};

export default TeamRadar;
