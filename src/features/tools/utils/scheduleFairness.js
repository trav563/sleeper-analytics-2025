/**
 * Schedule fairness scoring (0-100).
 *
 * Two modes:
 * - Structural: matchup distribution balance only (always available)
 * - Performance: adds opponent quality weighting (when fpts data exists)
 */

export function calculateFairness(schedule, teams, rosters) {
  const teamIds = teams.map(t => t.id);
  const hasPerformanceData = rosters?.some(r => r.settings?.fpts > 0);

  const structural = calculateStructuralScore(schedule, teamIds);

  if (hasPerformanceData) {
    const performance = calculatePerformanceScore(schedule, teamIds, rosters);
    return {
      score: Math.round(performance.score * 0.6 + structural.score * 0.4),
      mode: 'performance',
      label: `Opponent Fairness`,
      breakdown: {
        structural: structural.score,
        performance: performance.score,
        details: {
          ...structural.details,
          ...performance.details,
        },
      },
    };
  }

  return {
    score: structural.score,
    mode: 'structural',
    label: `Schedule Balance`,
    breakdown: {
      structural: structural.score,
      details: structural.details,
    },
  };
}

/**
 * Structural score: how evenly are matchups distributed?
 * Measures variance in matchup counts across all pairs.
 */
function calculateStructuralScore(schedule, teamIds) {
  const n = teamIds.length;

  // Count matchups per pair
  const counts = {};
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      counts[`${teamIds[i]}|${teamIds[j]}`] = 0;
    }
  }

  for (const week of schedule) {
    for (const m of week.matchups) {
      const key = [m.teamA, m.teamB].sort().join('|');
      if (key in counts) counts[key]++;
    }
  }

  const values = Object.values(counts);
  if (values.length === 0) return { score: 100, details: {} };

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

  // Perfect score = 0 variance. Score decreases as variance increases.
  // Normalize: variance of 0 = 100, variance of 1 = 75, variance of 2 = 50, etc.
  const distributionScore = Math.max(0, Math.round(100 - variance * 25));

  // Also check: does each team play the same total number of games?
  const gamesPerTeam = {};
  for (const id of teamIds) gamesPerTeam[id] = 0;

  for (const week of schedule) {
    for (const m of week.matchups) {
      gamesPerTeam[m.teamA]++;
      gamesPerTeam[m.teamB]++;
    }
  }

  const gameValues = Object.values(gamesPerTeam);
  const gameVariance = computeVariance(gameValues);
  const gamesScore = gameVariance === 0 ? 100 : Math.max(0, Math.round(100 - gameVariance * 50));

  const score = Math.round(distributionScore * 0.7 + gamesScore * 0.3);

  return {
    score,
    details: {
      matchupVariance: round2(variance),
      gamesVariance: round2(gameVariance),
      avgGamesPerPair: round2(mean),
    },
  };
}

/**
 * Performance score: measures variance in strength-of-schedule across teams.
 * Lower SOS variance = fairer schedule.
 */
function calculatePerformanceScore(schedule, teamIds, rosters) {
  // Build team strength map from fpts
  const strength = {};
  for (const id of teamIds) {
    const roster = rosters.find(r => String(r.roster_id) === String(id) || r.owner_id === id);
    strength[id] = roster?.settings?.fpts || 0;
  }

  // Calculate SOS for each team (average opponent strength)
  const sos = {};
  const opponentCounts = {};

  for (const id of teamIds) {
    sos[id] = 0;
    opponentCounts[id] = 0;
  }

  for (const week of schedule) {
    for (const m of week.matchups) {
      sos[m.teamA] += strength[m.teamB] || 0;
      sos[m.teamB] += strength[m.teamA] || 0;
      opponentCounts[m.teamA]++;
      opponentCounts[m.teamB]++;
    }
  }

  // Average SOS per team
  const avgSos = {};
  for (const id of teamIds) {
    avgSos[id] = opponentCounts[id] > 0 ? sos[id] / opponentCounts[id] : 0;
  }

  const sosValues = Object.values(avgSos);
  const sosVariance = computeVariance(sosValues);
  const sosMean = sosValues.reduce((s, v) => s + v, 0) / sosValues.length;

  // Coefficient of variation: normalize variance by mean to handle different league scoring scales
  const cv = sosMean > 0 ? Math.sqrt(sosVariance) / sosMean : 0;

  // CV of 0 = perfect (100), CV of 0.1 = 80, CV of 0.2 = 60, etc.
  const score = Math.max(0, Math.round(100 - cv * 200));

  return {
    score,
    details: {
      sosVariance: round2(sosVariance),
      sosMean: round2(sosMean),
      coefficientOfVariation: round2(cv),
    },
  };
}

function computeVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
