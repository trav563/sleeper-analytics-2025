import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { leagueRecords, medianEnabled, medianScore } from '../../../utils/leagueRecords';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { fetchLeague, fetchLeagueMatchups } from '../../../utils/sleeper';

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

/** One score per roster feeds both competitions and points-for exactly once. */
export function applySimulatedWeek(simState, scores, weekGames, median = false) {
    for (const [id, score] of Object.entries(scores)) simState[id].fpts += score;
    for (const pair of weekGames) {
        if (pair.length !== 2) continue;
        const [a, b] = pair;
        if (!simState[a] || !simState[b]) continue;
        if (scores[a] > scores[b]) simState[a].wins++;
        else if (scores[b] > scores[a]) simState[b].wins++;
        else { simState[a].wins += 0.5; simState[b].wins += 0.5; }
    }
    if (median) {
        const mid = medianScore(Object.values(scores));
        for (const [id, score] of Object.entries(scores)) simState[id].wins += score > mid ? 1 : score === mid ? 0.5 : 0;
    }
}

/**
 * First week the Monte Carlo should simulate. Sleeper finalizes
 * roster.settings records at the end of a week before display_week advances,
 * so in that window `currentWeek`'s result is already in the standings and
 * simulating it again would double-count.
 */
export function firstWeekToSimulate(teams, currentWeek) {
    if (teams.length && teams.every(t => Number.isFinite(t.throughWeek))) {
        return Math.max(...teams.map(t => t.throughWeek)) + 1;
    }
    const maxGamesPlayed = Math.max(0, ...teams.map(t => t.throughWeek ?? t.weeksPlayed ?? t.gamesPlayed ?? 0));
    return maxGamesPlayed >= currentWeek ? currentWeek + 1 : currentWeek;
}

/**
 * Pure in-season Monte Carlo: returns { rosterId: playoffAppearances } over
 * `simulations` runs. Deterministic for a given seedString.
 */
export function simulateInSeasonOdds({ teams, processedSchedule, playoffSpots, seedString, simulations = 10000, median = false }) {
    const rng = mulberry32(hashSeed(seedString));
    const results = {};
    teams.forEach(t => { results[t.rosterId] = 0; });

    for (let i = 0; i < simulations; i++) {
        const simState = {};
        teams.forEach(t => {
            simState[t.rosterId] = {
                wins: t.currentWins + (t.currentTies || 0) / 2,
                fpts: t.currentFpts,
                rosterId: t.rosterId,
                tieBreak: rng(),
            };
        });

        processedSchedule.forEach(weekGames => {
            const scores = Object.fromEntries(teams.map(t => [t.rosterId, t.ppg * (1 + VARIANCE_FACTOR * gaussian(rng))]));
            applySimulatedWeek(simState, scores, weekGames, median);
        });

        const sorted = Object.values(simState).sort((a, b) => {
            if (a.wins !== b.wins) return b.wins - a.wins;
            return b.fpts - a.fpts || b.tieBreak - a.tieBreak;
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
    const { seasonMatchups, loading: loadingCompleted, error: completedError, completedWeek } = useSeasonMatchups(league?.league_id, currentWeek);
    const { data: previousLeague } = useQuery({ queryKey: ['league', league?.previous_league_id], queryFn: () => fetchLeague(league.previous_league_id), enabled: completedWeek === 0 && !!league?.previous_league_id, staleTime: 3600000 });
    const { seasonMatchups: previousMatchups } = useSeasonMatchups(completedWeek === 0 ? previousLeague?.league_id : null, (previousLeague?.settings?.playoff_week_start || 19) - 1);
    const previousRecords = useMemo(() => leagueRecords(prevSeasonRosters || [], previousMatchups, previousLeague), [prevSeasonRosters, previousMatchups, previousLeague]);
    const finalRosters = useMemo(() => {
        const final = leagueRecords(rosters, seasonMatchups, league);
        return (rosters || []).map(r => {
            const s = final.find(t => t.rosterId === r.roster_id);
            return { ...r, recordStats: s, settings: { ...r.settings, wins: s?.wins || 0, losses: s?.losses || 0, ties: s?.ties || 0, fpts: s?.totalPoints || 0, fpts_decimal: 0 } };
        });
    }, [rosters, seasonMatchups, league]);
    const [odds, setOdds] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isProjection, setIsProjection] = useState(false);

    // Housekeeping only — prune expired cache entries once on mount instead of
    // re-scanning all of localStorage on every input-identity change. readCache
    // already TTL-checks per entry, so this is purely to reclaim space.
    useEffect(() => { pruneStaleCache(); }, []);

    useEffect(() => {
        if (!league || !rosters || !currentWeek || loadingCompleted) {
            setOdds(null);
            return;
        }

        let cancelled = false;

        const runSimulation = async () => {
            setLoading(true);
            setOdds(null);
            if (completedError || finalRosters.some(r => !r.recordStats?.complete)) { setLoading(false); return; }
            try {
                const playoffStartWeek = league.settings.playoff_week_start || 19;
                const playoffSpots = league.settings.playoff_teams || 6;

                const teams = finalRosters.map(r => {
                    const gamesPlayed = r.recordStats.weeksPlayed;
                    const fpts = r.settings.fpts + (r.settings.fpts_decimal || 0) / 100;
                    const ppg = gamesPlayed > 0 ? fpts / gamesPlayed : 0;

                    return {
                        rosterId: r.roster_id,
                        ownerId: r.owner_id,
                        currentWins: r.settings.wins,
                        currentTies: r.settings.ties,
                        currentFpts: fpts,
                        gamesPlayed,
                        throughWeek: r.recordStats.throughWeek,
                        ppg: ppg,
                        players: r.players || []
                    };
                });

                const weeksToSimulate = [];
                for (let w = Math.max(league.settings.start_week || 1, firstWeekToSimulate(teams, currentWeek)); w < playoffStartWeek; w++) {
                    weeksToSimulate.push(w);
                }

                const isOffseasonState = seasonType === 'off' || seasonType === 'pre' || teams.every(t => !t.gamesPlayed);

                // --- OFFSEASON PROJECTION ---
                if (isOffseasonState) {
                    const prevStatsByOwner = {};
                    if (prevSeasonRosters && prevSeasonRosters.length > 0) {
                        prevSeasonRosters.forEach(r => {
                            const s = r.settings;
                            const prior = previousRecords.find(t => t.rosterId === r.roster_id);
                            const gp = prior?.complete ? prior.weeksPlayed : 0;
                            const fpts = prior?.totalPoints || 0;
                            if (!gp) return; // Missing history is not a zero-production season.
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
                        'preseason-v3', JSON.stringify(league.settings),
                        teams
                            .map(t => `${t.rosterId}:${(t.players || []).slice().sort().join('-')}:${prevStatsByOwner[t.ownerId]?.ppg || 0}:${prevStatsByOwner[t.ownerId]?.ppts || 0}:${dynastyValues[teams.indexOf(t)]}`)
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

                    const totalRegularWeeks = playoffStartWeek - (league.settings.start_week || 1);
                    const syntheticSchedule = generateRoundRobin(teams.map(t => t.rosterId), totalRegularWeeks);
                    const SIMULATIONS = 10000;
                    const results = simulateInSeasonOdds({
                        teams: teams.map(t => ({ ...t, currentWins: 0, currentTies: 0, currentFpts: 0, ppg: 50 + 100 * (teamStrengths[t.rosterId] || 0) })),
                        processedSchedule: syntheticSchedule, playoffSpots, seedString, simulations: SIMULATIONS, median: medianEnabled(league),
                    });
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
                        const aWins = a.currentWins + a.currentTies / 2, bWins = b.currentWins + b.currentTies / 2;
                        if (aWins !== bWins) return bWins - aWins;
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

                // v3 includes league-median outcomes and the full simulation inputs.
                let seedString = [
                    league.league_id,
                    'v3', JSON.stringify(league.settings),
                    `wk${currentWeek}`,
                    teams
                        .map(t => `${t.rosterId}:${t.currentWins}:${t.currentTies}:${t.currentFpts.toFixed(2)}`)
                        .sort()
                        .join('|'),
                ].join('::');


                const schedulePromises = weeksToSimulate.map(w => fetchLeagueMatchups(league.league_id, w));
                const schedule = await Promise.all(schedulePromises);

                const processedSchedule = schedule.map(weekMatchups => {
                    const ids = new Set(weekMatchups?.map(m => m.roster_id));
                    if (ids.size !== teams.length || teams.some(t => !ids.has(t.rosterId))) throw new Error('Incomplete future schedule');
                    const matchupsById = {};
                    weekMatchups.forEach(m => {
                        if (m.matchup_id == null) return;
                        if (!matchupsById[m.matchup_id]) matchupsById[m.matchup_id] = [];
                        matchupsById[m.matchup_id].push(m.roster_id);
                    });
                    return Object.values(matchupsById);
                });

                seedString += '::' + JSON.stringify(processedSchedule) + '::' + JSON.stringify(teams);
                const cached = readCache(seedString);
                if (cached?.odds) { if (!cancelled) setOdds(cached.odds); return; }
                const SIMULATIONS = 10000;
                const results = simulateInSeasonOdds({
                    teams,
                    processedSchedule,
                    playoffSpots,
                    seedString,
                    simulations: SIMULATIONS,
                    median: medianEnabled(league),
                });

                const finalOdds = {};
                teams.forEach(t => {
                    const made = results[t.rosterId];
                    const percent = (made / SIMULATIONS) * 100;
                    let status = "In the Hunt";
                    if (percent >= 99.95) status = 'Strong favorite';
                    if (percent < 0.05) status = 'Long shot';

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
    }, [league, rosters, finalRosters, loadingCompleted, currentWeek, marketValues, seasonType, prevSeasonRosters, previousRecords, completedError]);

    return { odds, loading, isProjection };
}
