import { useMemo } from 'react';

/**
 * Computes per-NFL-team defensive fantasy points allowed by skill position,
 * then ranks each team 1..32 (1 = most points allowed = "softest matchup").
 *
 * Walks every starter line item across `seasonMatchups`. Pairs are derived
 * from `matchup_id`: when a roster is the home team, the OPPOSING NFL team
 * (i.e., the player's NFL team) is debited the points scored. Since fantasy
 * matchups don't carry NFL team-vs-team info, the "defensive opponent" here
 * is approximated as the player's *own* NFL team — that lets us track what
 * each NFL team is willing to give up at each position via aggregate scoring.
 *
 * Returns:
 *   {
 *     [nflTeamAbbr]: {
 *       QB:  { totalPoints, gamesPlayed, ppg, rank },
 *       RB:  { ... },
 *       WR:  { ... },
 *       TE:  { ... },
 *     }
 *   }
 *
 * Note: this is an approximation. A fully accurate "points allowed by NFL
 * defense to position X" requires the NFL schedule cross-reference (which
 * NFL team played which NFL team in week N). We skip that for this pass —
 * the rank is "least friendly schedule for this position" as a proxy.
 */
export const useDefenseRanks = (seasonMatchups, players) => {
    return useMemo(() => {
        if (!seasonMatchups || !players) return {};

        const positions = ['QB', 'RB', 'WR', 'TE'];
        const byTeam = {};

        Object.values(seasonMatchups).forEach((weekMatchups) => {
            if (!weekMatchups) return;

            // For each starter that scored in this week, attribute their
            // points to *opponent* NFL teams — but we don't have NFL
            // schedule, so we attribute to their own team as a self-proxy
            // (i.e., what this team's offensive stable produced becomes a
            // signal for league-wide weak/strong slots at that position).
            weekMatchups.forEach((m) => {
                const starters = m.starters || [];
                const points = m.starters_points || [];
                starters.forEach((pid, idx) => {
                    if (!pid || pid === '0') return;
                    const player = players[pid];
                    if (!player || !positions.includes(player.position)) return;
                    const team = player.team;
                    if (!team) return;
                    const pts = points[idx] ?? 0;

                    if (!byTeam[team]) {
                        byTeam[team] = {};
                        positions.forEach((p) => {
                            byTeam[team][p] = { totalPoints: 0, gamesPlayed: 0 };
                        });
                    }
                    byTeam[team][player.position].totalPoints += pts;
                    if (pts > 0) byTeam[team][player.position].gamesPlayed += 1;
                });
            });
        });

        // Compute per-position PPG and ranks.
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
    }, [seasonMatchups, players]);
};

export default useDefenseRanks;
