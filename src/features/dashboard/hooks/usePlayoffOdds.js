import { useState, useEffect } from 'react';
import { fetchLeagueMatchups } from '../../../utils/sleeper';

/**
 * Generate a round-robin schedule for N teams over totalWeeks weeks.
 * Wraps around if totalWeeks > N-1.
 */
function generateRoundRobin(rosterIds, totalWeeks) {
    const ids = [...rosterIds];
    if (ids.length % 2 !== 0) ids.push(null); // bye slot for odd teams
    const n = ids.length;
    const rounds = [];

    for (let week = 0; week < totalWeeks; week++) {
        const r = week % (n - 1);
        // Rotate ids[1..n-1] by r positions, keep ids[0] fixed
        const rest = ids.slice(1);
        const rotated = [...rest.slice(r), ...rest.slice(0, r)];
        const thisRound = [ids[0], ...rotated];

        const games = [];
        for (let i = 0; i < n / 2; i++) {
            const t1 = thisRound[i];
            const t2 = thisRound[n - 1 - i];
            if (t1 !== null && t2 !== null) {
                games.push([t1, t2]);
            }
        }
        rounds.push(games);
    }
    return rounds;
}

function offseasonWinProbability(strengthA, strengthB) {
    if (strengthA === 0 && strengthB === 0) return 0.5;
    const EXPONENT = 0.8;
    const adjA = Math.pow(strengthA, EXPONENT);
    const adjB = Math.pow(strengthB, EXPONENT);
    return adjA / (adjA + adjB);
}

export function usePlayoffOdds(league, rosters, currentWeek, marketValues, seasonType) {
    const [odds, setOdds] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isProjection, setIsProjection] = useState(false);

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
                        ppg: ppg,
                        maxPF: r.settings.ppts + (r.settings.ppts_decimal || 0) / 100,
                        players: r.players || []
                    };
                });

                // 2. Determine weeks to simulate
                const weeksToSimulate = [];
                for (let w = currentWeek; w < playoffStartWeek; w++) {
                    weeksToSimulate.push(w);
                }

                // 3. Check for offseason via NFL state season_type
                const isOffseasonState = seasonType === 'off' || seasonType === 'pre';

                // --- OFFSEASON PROJECTION ---
                if (isOffseasonState) {
                    // Normalize helper: scale values 0-1 across all teams
                    const normalize = (values) => {
                        const min = Math.min(...values);
                        const max = Math.max(...values);
                        if (max === min) return values.map(() => 0);
                        return values.map(v => (v - min) / (max - min));
                    };

                    // Gather raw signals
                    const ppgValues = teams.map(t => t.ppg);
                    const maxPFValues = teams.map(t => t.maxPF);
                    const dynastyValues = teams.map(t =>
                        t.players.reduce((sum, pid) => sum + (marketValues?.[pid] || 0), 0)
                    );

                    // Normalize each signal
                    const normPPG = normalize(ppgValues);
                    const normMaxPF = normalize(maxPFValues);
                    const normDynasty = normalize(dynastyValues);

                    // Check which signals have meaningful data
                    const hasPrevSeason = ppgValues.some(v => v > 0) || maxPFValues.some(v => v > 0);
                    const hasDynastyData = dynastyValues.some(v => v > 0);

                    // Compute blended team strength
                    const teamStrengths = {};
                    if (!hasPrevSeason && !hasDynastyData) {
                        // Brand new league with no data — equal odds
                        const equalPercent = Number(((playoffSpots / teams.length) * 100).toFixed(1));
                        const fallbackOdds = {};
                        teams.forEach(t => {
                            fallbackOdds[t.rosterId] = { percent: equalPercent, status: 'In the Mix' };
                        });
                        setOdds(fallbackOdds);
                        setIsProjection(true);
                        setLoading(false);
                        return;
                    }

                    teams.forEach((t, i) => {
                        if (hasPrevSeason && hasDynastyData) {
                            // All signals available: 40% PPG, 30% MaxPF, 30% Dynasty
                            teamStrengths[t.rosterId] = 0.4 * normPPG[i] + 0.3 * normMaxPF[i] + 0.3 * normDynasty[i];
                        } else if (hasPrevSeason) {
                            // No dynasty data: 60% PPG, 40% MaxPF
                            teamStrengths[t.rosterId] = 0.6 * normPPG[i] + 0.4 * normMaxPF[i];
                        } else {
                            // Only dynasty data available
                            teamStrengths[t.rosterId] = normDynasty[i];
                        }
                    });

                    // Generate synthetic round-robin schedule
                    const totalRegularWeeks = playoffStartWeek - 1;
                    const rosterIds = teams.map(t => t.rosterId);
                    const syntheticSchedule = generateRoundRobin(rosterIds, totalRegularWeeks);

                    // Run Monte Carlo
                    const SIMULATIONS = 10000;
                    const results = {};
                    teams.forEach(t => results[t.rosterId] = 0);

                    for (let i = 0; i < SIMULATIONS; i++) {
                        const simState = {};
                        teams.forEach(t => {
                            simState[t.rosterId] = { wins: 0, fpts: 0, rosterId: t.rosterId };
                        });

                        syntheticSchedule.forEach(weekGames => {
                            weekGames.forEach(([r1, r2]) => {
                                const s1 = teamStrengths[r1] || 0;
                                const s2 = teamStrengths[r2] || 0;
                                const prob1 = offseasonWinProbability(s1, s2);

                                if (Math.random() < prob1) {
                                    simState[r1].wins += 1;
                                } else {
                                    simState[r2].wins += 1;
                                }

                                // Randomized points proxy for tiebreaking
                                simState[r1].fpts += s1 * (0.8 + Math.random() * 0.4);
                                simState[r2].fpts += s2 * (0.8 + Math.random() * 0.4);
                            });
                        });

                        // Rank teams
                        const sorted = Object.values(simState).sort((a, b) => {
                            if (a.wins !== b.wins) return b.wins - a.wins;
                            return b.fpts - a.fpts;
                        });

                        for (let k = 0; k < playoffSpots; k++) {
                            if (sorted[k]) {
                                results[sorted[k].rosterId]++;
                            }
                        }
                    }

                    // Calculate percentages with offseason labels
                    const finalOdds = {};
                    teams.forEach(t => {
                        const percent = Number(((results[t.rosterId] / SIMULATIONS) * 100).toFixed(1));
                        let status = 'In the Mix';
                        if (percent >= 75) status = 'Favorite';
                        else if (percent >= 40) status = 'Contender';
                        else if (percent < 15) status = 'Long Shot';

                        finalOdds[t.rosterId] = { percent, status };
                    });

                    setOdds(finalOdds);
                    setIsProjection(true);
                    setLoading(false);
                    return;
                }

                // --- REGULAR SEASON OVER (real records exist) ---
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
                    setIsProjection(false);
                    setLoading(false);
                    return;
                }

                // --- IN-SEASON MONTE CARLO (unchanged) ---
                setIsProjection(false);

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
    }, [league, rosters, currentWeek, marketValues, seasonType]);

    return { odds, loading, isProjection };
}
