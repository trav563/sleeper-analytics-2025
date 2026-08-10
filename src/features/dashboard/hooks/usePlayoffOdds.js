import { useState, useEffect } from 'react';
import { fetchLeagueMatchups } from '../../../utils/sleeper';

const CACHE_PREFIX = 'playoffOdds:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

function normalize(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 0);
    return values.map(v => (v - min) / (max - min));
}

// FNV-1a 32-bit hash → unsigned int. Used to derive a deterministic PRNG seed
// from a stable composite string of the simulation inputs.
function hashSeed(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// mulberry32 PRNG. Given the same seed, always produces the same sequence.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Standard normal sample (Box-Muller) driven by the seeded PRNG.
function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Same weekly-score model as src/lib/winProbability.js:
// score ~ Normal(ppg, (ppg * 0.18)^2). Sampling scores (instead of a fixed
// ppg ratio) gives wins realistic variance AND makes the points-for
// tiebreaker vary across simulations instead of resolving identically.
const VARIANCE_FACTOR = 0.18;

/**
 * First week the Monte Carlo should simulate. Sleeper finalizes
 * roster.settings records at the end of a week before display_week advances,
 * so in that window `currentWeek`'s result is already in the standings and
 * simulating it again would double-count.
 */
export function firstWeekToSimulate(teams, currentWeek) {
    const maxGamesPlayed = Math.max(0, ...teams.map(t => t.gamesPlayed || 0));
    return maxGamesPlayed >= currentWeek ? currentWeek + 1 : currentWeek;
}

/**
 * Pure in-season Monte Carlo: returns { rosterId: playoffAppearances } over
 * `simulations` runs. Deterministic for a given seedString.
 */
export function simulateInSeasonOdds({ teams, processedSchedule, playoffSpots, seedString, simulations = 10000 }) {
    const rng = mulberry32(hashSeed(seedString));
    const results = {};
    teams.forEach(t => { results[t.rosterId] = 0; });

    for (let i = 0; i < simulations; i++) {
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
                const [r1, r2] = pair;
                const team1 = teams.find(t => t.rosterId === r1);
                const team2 = teams.find(t => t.rosterId === r2);
                if (!team1 || !team2) return;

                const s1 = team1.ppg * (1 + VARIANCE_FACTOR * gaussian(rng));
                const s2 = team2.ppg * (1 + VARIANCE_FACTOR * gaussian(rng));

                if (s1 > s2) simState[r1].wins += 1;
                else if (s2 > s1) simState[r2].wins += 1;
                else if (rng() < 0.5) simState[r1].wins += 1; // e.g. both ppg 0 early season
                else simState[r2].wins += 1;

                simState[r1].fpts += s1;
                simState[r2].fpts += s2;
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
    return results;
}

function readCache(seedKey) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + seedKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.ts !== 'number') return null;
        if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(seedKey, payload) {
    try {
        localStorage.setItem(CACHE_PREFIX + seedKey, JSON.stringify({ ...payload, ts: Date.now() }));
    } catch {
        // localStorage may be full or disabled — silently skip.
    }
}

function pruneStaleCache() {
    try {
        const now = Date.now();
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(CACHE_PREFIX)) continue;
            try {
                const parsed = JSON.parse(localStorage.getItem(key));
                if (!parsed || typeof parsed.ts !== 'number' || now - parsed.ts > CACHE_TTL_MS) {
                    localStorage.removeItem(key);
                }
            } catch {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // ignore
    }
}

export function usePlayoffOdds(league, rosters, currentWeek, marketValues, seasonType, prevSeasonRosters) {
    const [odds, setOdds] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isProjection, setIsProjection] = useState(false);

    // Housekeeping only — prune expired cache entries once on mount instead of
    // re-scanning all of localStorage on every input-identity change. readCache
    // already TTL-checks per entry, so this is purely to reclaim space.
    useEffect(() => { pruneStaleCache(); }, []);

    useEffect(() => {
        if (!league || !rosters || !currentWeek) return;

        let cancelled = false;

        const runSimulation = async () => {
            setLoading(true);
            try {
                const playoffStartWeek = league.settings.playoff_week_start;
                const playoffSpots = league.settings.playoff_teams;

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
                        gamesPlayed,
                        ppg: ppg,
                        players: r.players || []
                    };
                });

                const weeksToSimulate = [];
                for (let w = firstWeekToSimulate(teams, currentWeek); w < playoffStartWeek; w++) {
                    weeksToSimulate.push(w);
                }

                const isOffseasonState = seasonType === 'off' || seasonType === 'pre';

                // --- OFFSEASON PROJECTION ---
                if (isOffseasonState) {
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

                    const ppgValues = teams.map(t => prevStatsByOwner[t.ownerId]?.ppg || 0);
                    const maxPFValues = teams.map(t => prevStatsByOwner[t.ownerId]?.ppts || 0);
                    const dynastyValues = teams.map(t =>
                        t.players.reduce((sum, pid) => sum + (marketValues?.[pid] || 0), 0)
                    );

                    const hasPrevSeason = ppgValues.some(v => v > 0);
                    const hasDynastyData = dynastyValues.some(v => v > 0);

                    if (!hasPrevSeason && !hasDynastyData) {
                        return;
                    }

                    const normPPG = normalize(ppgValues);
                    const normMaxPF = normalize(maxPFValues);
                    const normDynasty = normalize(dynastyValues);

                    const teamStrengths = {};
                    teams.forEach((t, i) => {
                        if (hasPrevSeason && hasDynastyData) {
                            teamStrengths[t.rosterId] = 0.4 * normPPG[i] + 0.3 * normMaxPF[i] + 0.3 * normDynasty[i];
                        } else if (hasPrevSeason) {
                            teamStrengths[t.rosterId] = 0.6 * normPPG[i] + 0.4 * normMaxPF[i];
                        } else {
                            teamStrengths[t.rosterId] = normDynasty[i];
                        }
                    });

                    // Build a deterministic seed from the inputs that should change the answer.
                    const seedString = [
                        league.league_id,
                        'preseason',
                        teams
                            .map(t => `${t.rosterId}:${(t.players || []).slice().sort().join('-')}:${(prevStatsByOwner[t.ownerId]?.ppg || 0).toFixed(2)}:${dynastyValues[teams.indexOf(t)].toFixed(0)}`)
                            .sort()
                            .join('|'),
                    ].join('::');

                    const cached = readCache(seedString);
                    if (cached?.odds) {
                        if (cancelled) return;
                        setOdds(cached.odds);
                        setIsProjection(true);
                        setLoading(false);
                        return;
                    }

                    const rng = mulberry32(hashSeed(seedString));
                    const totalRegularWeeks = playoffStartWeek - 1;
                    const rosterIds = teams.map(t => t.rosterId);
                    const syntheticSchedule = generateRoundRobin(rosterIds, totalRegularWeeks);

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

                                if (rng() < prob1) {
                                    simState[r1].wins += 1;
                                } else {
                                    simState[r2].wins += 1;
                                }

                                simState[r1].fpts += s1 * (0.8 + rng() * 0.4);
                                simState[r2].fpts += s2 * (0.8 + rng() * 0.4);
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

                    if (cancelled) return;
                    writeCache(seedString, { odds: finalOdds, isProjection: true });
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

                    if (cancelled) return;
                    setOdds(finalOdds);
                    setIsProjection(false);
                    setLoading(false);
                    return;
                }

                // --- IN-SEASON MONTE CARLO ---
                setIsProjection(false);

                // v2: score-sampling model — must not reuse v1 cached results.
                const seedString = [
                    league.league_id,
                    'v2',
                    `wk${currentWeek}`,
                    teams
                        .map(t => `${t.rosterId}:${t.currentWins}:${t.currentTies}:${t.currentFpts.toFixed(2)}`)
                        .sort()
                        .join('|'),
                ].join('::');

                const cached = readCache(seedString);
                if (cached?.odds) {
                    if (cancelled) return;
                    setOdds(cached.odds);
                    setIsProjection(false);
                    setLoading(false);
                    return;
                }

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
                const results = simulateInSeasonOdds({
                    teams,
                    processedSchedule,
                    playoffSpots,
                    seedString,
                    simulations: SIMULATIONS,
                });

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

                if (cancelled) return;
                writeCache(seedString, { odds: finalOdds, isProjection: false });
                setOdds(finalOdds);

            } catch (err) {
                console.error("Error calculating playoff odds:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        runSimulation();

        return () => {
            cancelled = true;
        };
    }, [league, rosters, currentWeek, marketValues, seasonType, prevSeasonRosters]);

    return { odds, loading, isProjection };
}
