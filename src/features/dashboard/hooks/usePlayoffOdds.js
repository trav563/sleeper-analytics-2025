import { useState, useEffect } from 'react';
import { fetchLeagueMatchups } from '../../../utils/sleeper';

/**
 * Generate a round-robin schedule for N teams over totalWeeks weeks.
 * Wraps around if totalWeeks > N-1.
 */
function generateRoundRobin(rosterIds, totalWeeks) {
    const ids = [...rosterIds];
    if (ids.length % 2 !== 0) ids.push(null);
    const n = ids.length;
    const rounds = [];

    for (let week = 0; week < totalWeeks; week++) {
        const r = week % (n - 1);
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

/**
 * Normalize an array of values to 0-1 scale.
 * Returns all zeros if values are identical (no differentiation).
 */
function normalize(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 0);
    return values.map(v => (v - min) / (max - min));
}

export function usePlayoffOdds(league, rosters, currentWeek, marketValues, seasonType, prevSeasonRosters) {
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

                // 1. Prepare Team Data
                const teams = rosters.map(r => {
                    const gamesPlayed = r.settings.wins + r.settings.losses + r.settings.ties;
                    const fpts = r.settings.fpts + (r.settings.fpts_decimal || 0) / 100;
                    const ppg = gamesPlayed > 0 ? fpts / gamesPlayed : 0;

                    return {
                        rosterId: r.roster_id,
                        ownerId: r.owner_id,
                        currentWins: r.settings.wins,
                        currentTies: r.settings.ties,
                        currentFpts: fpts,
                        ppg: ppg,
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
                    // Build previous season stats by owner_id
                    const prevStatsByOwner = {};
                    if (prevSeasonRosters && prevSeasonRosters.length > 0) {
                        prevSeasonRosters.forEach(r => {
                            const s = r.settings;
                            const gp = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
                            const fpts = (s.fpts || 0) + ((s.fpts_decimal || 0) / 100);
                            const ppts = (s.ppts || 0) + ((s.ppts_decimal || 0) / 100);
                            prevStatsByOwner[r.owner_id] = {
                                ppg: gp > 0 ? fpts / gp : 0,
                                ppts: ppts
                            };
                        });
                    }

                    // Gather raw signals for each team
                    const ppgValues = teams.map(t => prevStatsByOwner[t.ownerId]?.ppg || 0);
                    const maxPFValues = teams.map(t => prevStatsByOwner[t.ownerId]?.ppts || 0);
                    const dynastyValues = teams.map(t =>
                        t.players.reduce((sum, pid) => sum + (marketValues?.[pid] || 0), 0)
                    );

                    // Check which signals have data
                    const hasPrevSeason = ppgValues.some(v => v > 0);
                    const hasDynastyData = dynastyValues.some(v => v > 0);

                    // Need at least one signal to produce meaningful odds
                    if (!hasPrevSeason && !hasDynastyData) {
                        // No data at all — keep loading state, wait for data to arrive
                        // (marketValues may still be loading from useQuery)
                        return;
                    }

                    // Normalize each signal
                    const normPPG = normalize(ppgValues);
                    const normMaxPF = normalize(maxPFValues);
                    const normDynasty = normalize(dynastyValues);

                    // Compute blended team strength
                    const teamStrengths = {};
                    teams.forEach((t, i) => {
                        if (hasPrevSeason && hasDynastyData) {
                            // All signals: 40% prev PPG, 30% prev MaxPF, 30% dynasty value
                            teamStrengths[t.rosterId] = 0.4 * normPPG[i] + 0.3 * normMaxPF[i] + 0.3 * normDynasty[i];
                        } else if (hasPrevSeason) {
                            // No dynasty data yet: 60% prev PPG, 40% prev MaxPF
                            teamStrengths[t.rosterId] = 0.6 * normPPG[i] + 0.4 * normMaxPF[i];
                        } else {
                            // Only dynasty data (no previous league history)
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

                                simState[r1].fpts += s1 * (0.8 + Math.random() * 0.4);
                                simState[r2].fpts += s2 * (0.8 + Math.random() * 0.4);
                            });
                        });

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

                const schedulePromises = weeksToSimulate.map(w => fetchLeagueMatchups(league.league_id, w));
                const schedule = await Promise.all(schedulePromises);

                const processedSchedule = schedule.map(weekMatchups => {
                    const matchupsById = {};
                    weekMatchups.forEach(m => {
                        if (!matchupsById[m.matchup_id]) matchupsById[m.matchup_id] = [];
                        matchupsById[m.matchup_id].push(m.roster_id);
                    });
                    return Object.values(matchupsById);
                });

                const SIMULATIONS = 10000;
                const results = {};
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

                    processedSchedule.forEach(weekGames => {
                        weekGames.forEach(pair => {
                            if (pair.length < 2) return;
                            const r1 = pair[0];
                            const r2 = pair[1];

                            const team1 = teams.find(t => t.rosterId === r1);
                            const team2 = teams.find(t => t.rosterId === r2);

                            if (!team1 || !team2) return;

                            const prob1 = team1.ppg / (team1.ppg + team2.ppg);

                            if (Math.random() < prob1) {
                                simState[r1].wins += 1;
                            } else {
                                simState[r2].wins += 1;
                            }

                            simState[r1].fpts += team1.ppg;
                            simState[r2].fpts += team2.ppg;
                        });
                    });

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
    }, [league, rosters, currentWeek, marketValues, seasonType, prevSeasonRosters]);

    return { odds, loading, isProjection };
}
