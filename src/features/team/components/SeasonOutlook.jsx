import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { displayTeamName } from '../../../utils/nflData';
import { theme } from '../../../lib/theme';

/**
 * Where this team is heading: playoff odds, power-ranking trend, and how hard
 * the rest of the schedule looks (opponents' average points per game).
 */
const SeasonOutlook = ({ league, roster, users, rosters, odds, isProjection, rankings, fullSchedule, currentWeek }) => {
    const mine = useMemo(
        () => rankings?.find((r) => r.rosterId === roster?.roster_id) || null,
        [rankings, roster]
    );

    const remainingSoS = useMemo(() => {
        if (!roster || !rosters?.length || !fullSchedule) return null;
        const playoffStart = league?.settings?.playoff_week_start || 15;

        // Opponent strength = actual points per game. Before any games are
        // played there is no such thing, so we report nothing rather than 0.0.
        const ppgByRoster = {};
        let anyGames = false;
        rosters.forEach((r) => {
            const s = r.settings || {};
            const gp = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
            const fpts = (s.fpts || 0) + (s.fpts_decimal || 0) / 100;
            if (gp > 0) anyGames = true;
            ppgByRoster[r.roster_id] = gp > 0 ? fpts / gp : 0;
        });

        const upcoming = [];
        for (let w = currentWeek; w < playoffStart; w++) {
            const wk = fullSchedule?.[w];
            if (!Array.isArray(wk)) continue;
            const me = wk.find((m) => m.roster_id === roster.roster_id);
            if (!me || me.matchup_id == null) continue;
            const opp = wk.find((m) => m.matchup_id === me.matchup_id && m.roster_id !== roster.roster_id);
            if (opp) upcoming.push({ week: w, rosterId: opp.roster_id, ppg: ppgByRoster[opp.roster_id] || 0 });
        }
        if (upcoming.length === 0) return null;

        const avg = anyGames ? upcoming.reduce((s, o) => s + o.ppg, 0) / upcoming.length : null;
        const leagueAvg =
            Object.values(ppgByRoster).reduce((s, v) => s + v, 0) / Math.max(1, rosters.length);
        return { games: upcoming.length, avg, leagueAvg, upcoming };
    }, [roster, rosters, fullSchedule, currentWeek, league]);

    const myOdds = odds?.[roster?.roster_id];

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-lg font-semibold text-text">Season Outlook</h3>
                </div>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    Playoff odds · power trend · remaining schedule
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-line border-b border-line">
                <div className="p-4 text-center">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">Playoff odds</div>
                    <div className="tnum font-display text-2xl font-bold text-signal mt-1">
                        {myOdds ? `${myOdds.percent}%` : '—'}
                    </div>
                    <div className="font-mono text-2xs text-text-mute mt-0.5">
                        {myOdds ? (isProjection ? 'preseason' : myOdds.status) : 'unavailable'}
                    </div>
                </div>
                <div className="p-4 text-center">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">Power rank</div>
                    <div className="tnum font-display text-2xl font-bold text-text mt-1">
                        {mine ? `#${mine.currentRank}` : '—'}
                    </div>
                    <div className="font-mono text-2xs text-text-mute mt-0.5">
                        {mine && mine.rankChange !== 0
                            ? `${mine.rankChange > 0 ? '▲' : '▼'} ${Math.abs(mine.rankChange)} this week`
                            : 'no change'}
                    </div>
                </div>
                <div className="p-4 text-center col-span-2 md:col-span-1 border-t md:border-t-0 border-line">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">Remaining SoS</div>
                    {remainingSoS?.avg != null ? (
                        <>
                            <div className={`tnum font-display text-2xl font-bold mt-1 ${
                                remainingSoS.avg > remainingSoS.leagueAvg ? 'text-bad' : 'text-good'
                            }`}>
                                {remainingSoS.avg.toFixed(1)}
                            </div>
                            <div className="font-mono text-2xs text-text-mute mt-0.5">
                                opp PPG · {remainingSoS.games} {remainingSoS.games === 1 ? 'game' : 'games'} left
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="tnum font-display text-2xl font-bold text-text-mute mt-1">—</div>
                            <div className="font-mono text-2xs text-text-mute mt-0.5">
                                {remainingSoS ? 'no games played yet' : 'schedule not posted'}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {mine?.trend?.length > 1 && (
                <div className="p-4">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">
                        Power rank trend
                    </div>
                    <div
                        className="h-16 w-full"
                        role="img"
                        aria-label={`Power ranking trend: currently ranked ${mine.currentRank} of ${rosters?.length}.`}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mine.trend}>
                                <Line
                                    type="monotone"
                                    dataKey="rank"
                                    stroke={theme.color.signal}
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {remainingSoS?.upcoming?.length > 0 && (
                <div className="px-4 pb-4">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">Next up</div>
                    <ul className="flex flex-wrap gap-1.5">
                        {remainingSoS.upcoming.slice(0, 6).map((o) => {
                            const oppRoster = rosters.find((r) => r.roster_id === o.rosterId);
                            const oppUser = users?.find((u) => u.user_id === oppRoster?.owner_id);
                            return (
                                <li
                                    key={o.week}
                                    className="font-mono text-2xs px-2 py-1 rounded-sm bg-bg-2 border border-line text-text-dim"
                                    title={`Week ${o.week} vs ${displayTeamName(oppUser)}`}
                                >
                                    W{o.week} · {displayTeamName(oppUser).slice(0, 12)}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
};

export default SeasonOutlook;
