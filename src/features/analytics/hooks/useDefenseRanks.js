import { useMemo } from 'react';
import nflOpponents from '../../../data/nflOpponents.json';

/**
 * Fantasy points each NFL defense ALLOWS by skill position, ranked 1..32
 * (1 = most points allowed = softest matchup).
 *
 * Attribution requires knowing which NFL team a player faced in a given week
 * — fantasy matchups carry no NFL team-vs-team info. That comes from the
 * nflverse schedule baked into src/data/nflOpponents.json (regenerate with
 * `npm run update-byes`).
 *
 * Every starter's points are debited to the defense they played against, so
 * "QB points allowed by IND" means what it says. A player whose NFL opponent
 * is unknown for that week (bye, or a season outside the generated data) is
 * skipped rather than misattributed.
 *
 * Returns { [nflTeamAbbr]: { QB|RB|WR|TE: { totalPoints, gamesPlayed, ppg, rank } } }
 */
export const useDefenseRanks = (seasonMatchups, players, season) => {
    return useMemo(() => {
        if (!seasonMatchups || !players) return {};

        const schedule = nflOpponents[String(season)];
        // Without the schedule we cannot say who allowed what — return nothing
        // rather than a number that means something else.
        if (!schedule) return {};

        const positions = ['QB', 'RB', 'WR', 'TE'];
        const byTeam = {};
        const ensure = (team) => {
            if (!byTeam[team]) {
                byTeam[team] = {};
                positions.forEach((p) => {
                    byTeam[team][p] = { totalPoints: 0, gamesPlayed: 0 };
                });
            }
            return byTeam[team];
        };

        Object.entries(seasonMatchups).forEach(([week, weekMatchups]) => {
            if (!Array.isArray(weekMatchups)) return;
            const weekOpponents = schedule[String(week)];
            if (!weekOpponents) return;

            weekMatchups.forEach((m) => {
                const starters = m.starters || [];
                const points = m.starters_points || [];
                starters.forEach((pid, idx) => {
                    if (!pid || pid === '0') return;
                    const player = players[pid];
                    if (!player || !positions.includes(player.position)) return;
                    if (!player.team) return;

                    // The defense that faced this player in this week.
                    const defense = weekOpponents[player.team];
                    if (!defense) return; // bye week or unknown

                    const pts = points[idx] ?? 0;
                    const slot = ensure(defense)[player.position];
                    slot.totalPoints += pts;
                    if (pts > 0) slot.gamesPlayed += 1;
                });
            });
        });

        // With no completed games every defense ties at 0, and the sort would
        // fall through to insertion order — an arbitrary number presented as a
        // rank. Report nothing instead.
        const anyGames = Object.values(byTeam).some((data) =>
            positions.some((p) => data[p].gamesPlayed > 0)
        );
        if (!anyGames) return {};

        // Rank by points allowed per game, most-allowed first.
        positions.forEach((pos) => {
            const ranking = Object.entries(byTeam)
                .map(([team, data]) => {
                    const slot = data[pos];
                    const ppg = slot.gamesPlayed > 0 ? slot.totalPoints / slot.gamesPlayed : 0;
                    slot.ppg = ppg;
                    return { team, ppg };
                })
                .sort((a, b) => b.ppg - a.ppg);

            ranking.forEach(({ team }, i) => {
                byTeam[team][pos].rank = i + 1;
            });
        });

        return byTeam;
    }, [seasonMatchups, players, season]);
};

export default useDefenseRanks;
