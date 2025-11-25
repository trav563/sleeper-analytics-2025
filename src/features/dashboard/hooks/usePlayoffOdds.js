import { useState, useEffect } from 'react';
import { fetchLeagueMatchups } from '../../../utils/sleeper';

export function usePlayoffOdds(league, rosters, currentWeek) {
    const [odds, setOdds] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!league || !rosters || !currentWeek) return;

        const runSimulation = async () => {
            setLoading(true);
            try {
                const playoffStartWeek = league.settings.playoff_week_start;
                const playoffSpots = league.settings.playoff_teams;

                // 1. Prepare Team Data (PPG, Current Record)
                const teams = rosters.map(r => {
                    const gamesPlayed = r.settings.wins + r.settings.losses + r.settings.ties;
                    const fpts = r.settings.fpts + (r.settings.fpts_decimal || 0) / 100;
                    const ppg = gamesPlayed > 0 ? fpts / gamesPlayed : 0;

                    return {
                        rosterId: r.roster_id,
                        currentWins: r.settings.wins,
                        currentTies: r.settings.ties,
                        currentFpts: fpts,
                        ppg: ppg
                    };
                });

                // 2. Determine weeks to simulate
                const weeksToSimulate = [];
                for (let w = currentWeek; w < playoffStartWeek; w++) {
                    weeksToSimulate.push(w);
                }

                // 3. Handle Regular Season Over
                if (weeksToSimulate.length === 0) {
                    const sorted = [...teams].sort((a, b) => {
                        if (a.currentWins !== b.currentWins) return b.currentWins - a.currentWins;
                        return b.currentFpts - a.currentFpts;
                    });

                    const finalOdds = {};
                    teams.forEach(t => {
                        const rank = sorted.findIndex(s => s.rosterId === t.rosterId);
                        const madePlayoffs = rank < playoffSpots;
                        finalOdds[t.rosterId] = {
                            percent: madePlayoffs ? 100 : 0,
                            status: madePlayoffs ? 'Clinched' : 'Eliminated'
                        };
                    });

                    setOdds(finalOdds);
                    setLoading(false);
                    return;
                }

                // 4. Fetch Schedule
                const schedulePromises = weeksToSimulate.map(w => fetchLeagueMatchups(league.league_id, w));
                const schedule = await Promise.all(schedulePromises);

                // 5. Pre-process schedule
                const processedSchedule = schedule.map(weekMatchups => {
                    const matchupsById = {};
                    weekMatchups.forEach(m => {
                        if (!matchupsById[m.matchup_id]) matchupsById[m.matchup_id] = [];
                        matchupsById[m.matchup_id].push(m.roster_id);
                    });
                    return Object.values(matchupsById); // Array of [rosterId1, rosterId2]
                });

                // 6. Run Monte Carlo (10,000 runs)
                const SIMULATIONS = 10000;
                const results = {}; // rosterId -> timesMadePlayoffs
                teams.forEach(t => results[t.rosterId] = 0);

                for (let i = 0; i < SIMULATIONS; i++) {
                    const simState = {};
                    teams.forEach(t => {
                        simState[t.rosterId] = {
                            wins: t.currentWins,
                            fpts: t.currentFpts,
                            rosterId: t.rosterId
                        };
                    });

                    // Simulate Games
                    processedSchedule.forEach(weekGames => {
                        weekGames.forEach(pair => {
                            if (pair.length < 2) return; // Bye or empty
                            const r1 = pair[0];
                            const r2 = pair[1];

                            const team1 = teams.find(t => t.rosterId === r1);
                            const team2 = teams.find(t => t.rosterId === r2);

                            if (!team1 || !team2) return;

                            // Weighted Probability
                            // P(A wins) = PPG_A / (PPG_A + PPG_B)
                            const prob1 = team1.ppg / (team1.ppg + team2.ppg);

                            if (Math.random() < prob1) {
                                simState[r1].wins += 1;
                            } else {
                                simState[r2].wins += 1;
                            }

                            // Add PPG to PF
                            simState[r1].fpts += team1.ppg;
                            simState[r2].fpts += team2.ppg;
                        });
                    });

                    // Rank Teams
                    const sorted = Object.values(simState).sort((a, b) => {
                        if (a.wins !== b.wins) return b.wins - a.wins;
                        return b.fpts - a.fpts;
                    });

                    // Top X make playoffs
                    for (let k = 0; k < playoffSpots; k++) {
                        if (sorted[k]) {
                            results[sorted[k].rosterId]++;
                        }
                    }
                }

                // 7. Calculate Percentages
                const finalOdds = {};
                teams.forEach(t => {
                    const made = results[t.rosterId];
                    const percent = (made / SIMULATIONS) * 100;
                    let status = "In the Hunt";
                    if (percent === 100) status = "Clinched";
                    if (percent === 0) status = "Eliminated";

                    finalOdds[t.rosterId] = {
                        percent: Number(percent.toFixed(1)),
                        status
                    };
                });

                setOdds(finalOdds);

            } catch (err) {
                console.error("Error calculating playoff odds:", err);
            } finally {
                setLoading(false);
            }
        };

        runSimulation();
    }, [league, rosters, currentWeek]);

    return { odds, loading };
}
