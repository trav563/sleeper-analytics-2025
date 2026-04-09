/**
 * Schedule generation using the circle method (round-robin) with constraint satisfaction.
 *
 * Input config shape:
 * {
 *   teams: [{ id, name }],
 *   weeks: number,
 *   maxRepeat: number,
 *   noBackToBack: boolean,
 *   divisions: { enabled, groups: [{ name, teamIds: [] }], intraGames, interGames } | null,
 *   rivalryWeek: { enabled, week, matchups: [{ teamA, teamB }] } | null,
 *   lockedWeeks: [{ week, matchups: [{ teamA, teamB }] }]
 * }
 *
 * Output shape:
 * {
 *   schedule: [{ week: number, matchups: [{ teamA, teamB }], isRivalry: bool, isLocked: bool, byes: [teamId] }],
 *   constraintReport: { satisfied: bool, violations: [{ type, message }] }
 * }
 */

const MAX_SWAP_ATTEMPTS = 1000;

export function generateSchedule(config) {
  const { teams, weeks, maxRepeat, noBackToBack, divisions, rivalryWeek, lockedWeeks = [] } = config;

  const teamIds = teams.map(t => t.id);
  const n = teamIds.length;
  const isOdd = n % 2 !== 0;
  const BYE = '__BYE__';

  // For odd teams, add a BYE placeholder
  const scheduleTeams = isOdd ? [...teamIds, BYE] : [...teamIds];
  const sn = scheduleTeams.length; // always even

  // Build target matchup matrix
  const target = buildTargetMatrix(teamIds, weeks, divisions);

  // Generate all possible rounds via circle method
  const allRounds = generateCircleRounds(scheduleTeams);

  // Collect fixed weeks (rivalry + locked)
  const fixedWeeks = new Map();
  if (rivalryWeek?.enabled && rivalryWeek.matchups) {
    fixedWeeks.set(rivalryWeek.week, {
      matchups: rivalryWeek.matchups.map(m => [m.teamA, m.teamB]),
      isRivalry: true,
      isLocked: false,
    });
  }
  for (const lw of lockedWeeks) {
    if (lw.matchups) {
      fixedWeeks.set(lw.week, {
        matchups: lw.matchups.map(m => [m.teamA, m.teamB]),
        isRivalry: false,
        isLocked: true,
      });
    }
  }

  // Track current matchup counts
  const counts = {};
  for (const id of teamIds) {
    counts[id] = {};
    for (const id2 of teamIds) {
      if (id !== id2) counts[id][id2] = 0;
    }
  }

  // Apply fixed week matchups to counts
  for (const [, fw] of fixedWeeks) {
    for (const [a, b] of fw.matchups) {
      if (a !== BYE && b !== BYE) {
        counts[a][b]++;
        counts[b][a]++;
      }
    }
  }

  // Select rounds for non-fixed weeks
  const freeWeekCount = weeks - fixedWeeks.size;
  const selectedRounds = selectRounds(allRounds, freeWeekCount, target, counts, maxRepeat, teamIds, BYE);

  // Build full schedule array
  const schedule = buildScheduleArray(weeks, fixedWeeks, selectedRounds, teamIds, BYE, isOdd);

  // Apply back-to-back constraint
  const violations = [];
  if (noBackToBack) {
    resolveBackToBack(schedule, fixedWeeks, violations, teamIds, MAX_SWAP_ATTEMPTS);
  }

  // Check max-repeat violations
  checkMaxRepeat(schedule, maxRepeat, violations, teamIds);

  // Build constraint report
  const constraintReport = {
    satisfied: violations.length === 0,
    violations,
  };

  // Format output
  const formattedSchedule = schedule.map(weekData => ({
    week: weekData.week,
    matchups: weekData.matchups.map(([a, b]) => ({ teamA: a, teamB: b })),
    isRivalry: weekData.isRivalry || false,
    isLocked: weekData.isLocked || false,
    byes: weekData.byes || [],
  }));

  return { schedule: formattedSchedule, constraintReport };
}

/**
 * Circle method: generates n-1 unique rounds for n teams (n must be even).
 * Each round is an array of pairs [teamA, teamB].
 */
function generateCircleRounds(teams) {
  const n = teams.length;
  const rounds = [];

  // Fix the first team, rotate the rest
  const fixed = teams[0];
  const rotating = teams.slice(1);

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    // Fixed team plays the team at position 0 of rotating
    round.push([fixed, rotating[0]]);

    // Pair remaining teams from outside in
    for (let i = 1; i < n / 2; i++) {
      const teamA = rotating[i];
      const teamB = rotating[n - 2 - i];
      round.push([teamA, teamB]);
    }

    rounds.push(round);

    // Rotate: move last element to front
    rotating.unshift(rotating.pop());
  }

  return rounds;
}

/**
 * Build target matchup matrix based on divisions or even distribution.
 */
function buildTargetMatrix(teamIds, weeks, divisions) {
  const target = {};
  for (const id of teamIds) {
    target[id] = {};
  }

  if (divisions?.enabled && divisions.groups?.length >= 2) {
    const { groups, intraGames, interGames } = divisions;
    const teamToDiv = {};
    for (const g of groups) {
      for (const tid of g.teamIds) {
        teamToDiv[tid] = g.name;
      }
    }

    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        const a = teamIds[i];
        const b = teamIds[j];
        const sameDiv = teamToDiv[a] === teamToDiv[b];
        const games = sameDiv ? intraGames : interGames;
        target[a][b] = games;
        target[b][a] = games;
      }
    }
  } else {
    // Even distribution
    const n = teamIds.length;
    const opponents = n - 1;
    const base = Math.floor(weeks / opponents);
    const extra = weeks % opponents;

    // Sort pairs to distribute extra games deterministically
    const pairs = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push([teamIds[i], teamIds[j]]);
      }
    }

    // Give each pair the base number of games, then distribute extras
    // We need each team to have exactly `weeks` total games
    // With round-robin, each team plays `opponents` unique opponents
    // Each gets base games, some get base+1
    for (const [a, b] of pairs) {
      target[a][b] = base;
      target[b][a] = base;
    }

    // Distribute extra games: each team needs `extra` additional games
    // We greedily assign extras to pairs where both teams still need more
    const teamExtras = {};
    for (const id of teamIds) {
      teamExtras[id] = extra;
    }

    for (const [a, b] of pairs) {
      if (teamExtras[a] > 0 && teamExtras[b] > 0) {
        target[a][b]++;
        target[b][a]++;
        teamExtras[a]--;
        teamExtras[b]--;
      }
    }
  }

  return target;
}

/**
 * Select rounds to fill free weeks, optimizing toward target matchup counts.
 */
function selectRounds(allRounds, freeWeekCount, target, counts, maxRepeat, teamIds, BYE) {
  const selected = [];

  for (let w = 0; w < freeWeekCount; w++) {
    let bestRound = null;
    let bestScore = -Infinity;

    for (const round of allRounds) {
      // Score: how much does adding this round reduce the gap to target?
      let score = 0;
      let valid = true;

      for (const [a, b] of round) {
        if (a === BYE || b === BYE) continue;

        const currentCount = counts[a][b] + countInSelected(selected, a, b);
        if (currentCount + 1 > maxRepeat) {
          valid = false;
          break;
        }

        const targetCount = target[a]?.[b] || 0;
        const gapBefore = targetCount - currentCount;
        const gapAfter = targetCount - (currentCount + 1);

        // Positive score if we're moving closer to target
        score += Math.abs(gapBefore) - Math.abs(gapAfter);
      }

      if (valid && score > bestScore) {
        bestScore = score;
        bestRound = round;
      }
    }

    if (bestRound) {
      selected.push(bestRound.map(pair => [...pair]));
    } else {
      // Fallback: pick any round even if it violates maxRepeat slightly
      // This handles edge cases where no perfect round exists
      let fallbackBest = null;
      let fallbackScore = -Infinity;

      for (const round of allRounds) {
        let score = 0;
        for (const [a, b] of round) {
          if (a === BYE || b === BYE) continue;
          const currentCount = counts[a][b] + countInSelected(selected, a, b);
          const targetCount = target[a]?.[b] || 0;
          score += Math.abs(targetCount - currentCount) - Math.abs(targetCount - (currentCount + 1));
        }
        if (score > fallbackScore) {
          fallbackScore = score;
          fallbackBest = round;
        }
      }

      if (fallbackBest) {
        selected.push(fallbackBest.map(pair => [...pair]));
      }
    }
  }

  return selected;
}

function countInSelected(selected, a, b) {
  let count = 0;
  for (const round of selected) {
    for (const [x, y] of round) {
      if ((x === a && y === b) || (x === b && y === a)) count++;
    }
  }
  return count;
}

/**
 * Build the full schedule array, interleaving fixed and selected rounds.
 */
function buildScheduleArray(weeks, fixedWeeks, selectedRounds, teamIds, BYE, isOdd) {
  const schedule = [];
  let freeIdx = 0;

  for (let w = 1; w <= weeks; w++) {
    if (fixedWeeks.has(w)) {
      const fw = fixedWeeks.get(w);
      // For fixed weeks with odd teams, figure out who has bye
      const byes = [];
      if (isOdd) {
        const usedTeams = new Set();
        for (const [a, b] of fw.matchups) {
          usedTeams.add(a);
          usedTeams.add(b);
        }
        for (const t of teamIds) {
          if (!usedTeams.has(t)) byes.push(t);
        }
      }

      schedule.push({
        week: w,
        matchups: fw.matchups,
        isRivalry: fw.isRivalry,
        isLocked: fw.isLocked,
        byes,
      });
    } else if (freeIdx < selectedRounds.length) {
      const round = selectedRounds[freeIdx++];
      const byes = [];
      const matchups = [];

      for (const [a, b] of round) {
        if (a === BYE) {
          byes.push(b);
        } else if (b === BYE) {
          byes.push(a);
        } else {
          matchups.push([a, b]);
        }
      }

      schedule.push({
        week: w,
        matchups,
        isRivalry: false,
        isLocked: false,
        byes,
      });
    }
  }

  return schedule;
}

/**
 * Resolve back-to-back matchups by swapping between non-adjacent weeks.
 * Uses calendar weeks (including across byes).
 */
function resolveBackToBack(schedule, fixedWeeks, violations, teamIds, maxAttempts) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const b2b = findBackToBack(schedule, teamIds);
    if (!b2b) break;

    const { weekIdx1, weekIdx2, pair } = b2b;

    // Try to swap a matchup from weekIdx2 with a matchup from a non-adjacent week
    let resolved = false;

    // Don't swap fixed weeks
    const w2 = schedule[weekIdx2];
    if (fixedWeeks.has(w2.week)) {
      // Try swapping from weekIdx1 instead if it's not fixed
      const w1 = schedule[weekIdx1];
      if (!fixedWeeks.has(w1.week)) {
        resolved = trySwapFromWeek(schedule, weekIdx1, pair, fixedWeeks);
      }
    } else {
      resolved = trySwapFromWeek(schedule, weekIdx2, pair, fixedWeeks);
    }

    if (!resolved) {
      violations.push({
        type: 'back-to-back',
        message: `Back-to-back: ${pair[0]} vs ${pair[1]} in weeks ${schedule[weekIdx1].week}-${schedule[weekIdx2].week} (could not resolve)`,
      });
      // Mark this pair as unresolvable and continue looking for others
      break;
    }

    attempts++;
  }

  // Final scan for any remaining violations
  let scan = true;
  while (scan) {
    const remaining = findBackToBack(schedule, teamIds);
    if (!remaining) {
      scan = false;
    } else {
      const alreadyReported = violations.some(
        v => v.type === 'back-to-back' &&
          v.message.includes(remaining.pair[0]) &&
          v.message.includes(remaining.pair[1])
      );
      if (!alreadyReported) {
        violations.push({
          type: 'back-to-back',
          message: `Back-to-back: ${remaining.pair[0]} vs ${remaining.pair[1]} in weeks ${schedule[remaining.weekIdx1].week}-${schedule[remaining.weekIdx2].week} (could not resolve)`,
        });
      }
      scan = false;
    }
  }
}

function findBackToBack(schedule, teamIds) {
  for (let i = 0; i < schedule.length - 1; i++) {
    const curr = schedule[i];
    const next = schedule[i + 1];

    const currPairs = curr.matchups.map(([a, b]) => [a, b].sort().join('|'));
    const nextPairs = next.matchups.map(([a, b]) => [a, b].sort().join('|'));

    for (const p of currPairs) {
      if (nextPairs.includes(p)) {
        return {
          weekIdx1: i,
          weekIdx2: i + 1,
          pair: p.split('|'),
        };
      }
    }
  }
  return null;
}

function trySwapFromWeek(schedule, weekIdx, pair, fixedWeeks) {
  const pairKey = pair.sort().join('|');
  const week = schedule[weekIdx];

  // Find the matchup index containing this pair
  const matchupIdx = week.matchups.findIndex(
    ([a, b]) => [a, b].sort().join('|') === pairKey
  );
  if (matchupIdx === -1) return false;

  // Try swapping with a matchup from a non-adjacent, non-fixed week
  for (let otherIdx = 0; otherIdx < schedule.length; otherIdx++) {
    // Must not be adjacent to weekIdx
    if (Math.abs(otherIdx - weekIdx) <= 1) continue;

    const otherWeek = schedule[otherIdx];
    if (fixedWeeks.has(otherWeek.week)) continue;

    for (let otherMatchupIdx = 0; otherMatchupIdx < otherWeek.matchups.length; otherMatchupIdx++) {
      const otherPairKey = otherWeek.matchups[otherMatchupIdx].slice().sort().join('|');

      // Don't swap if the other pair is the same
      if (otherPairKey === pairKey) continue;

      // Check that swapping won't create a new back-to-back
      // Temporarily swap and verify
      const saved1 = week.matchups[matchupIdx];
      const saved2 = otherWeek.matchups[otherMatchupIdx];

      week.matchups[matchupIdx] = saved2;
      otherWeek.matchups[otherMatchupIdx] = saved1;

      // Verify no new back-to-back around both affected weeks
      const ok1 = !hasBackToBackAt(schedule, weekIdx);
      const ok2 = !hasBackToBackAt(schedule, otherIdx);

      if (ok1 && ok2) {
        return true; // Swap stays
      }

      // Revert
      week.matchups[matchupIdx] = saved1;
      otherWeek.matchups[otherMatchupIdx] = saved2;
    }
  }

  return false;
}

function hasBackToBackAt(schedule, idx) {
  // Check idx with idx-1 and idx with idx+1
  for (const neighborIdx of [idx - 1, idx + 1]) {
    if (neighborIdx < 0 || neighborIdx >= schedule.length) continue;

    const curr = schedule[idx];
    const neighbor = schedule[neighborIdx];

    const currPairs = new Set(curr.matchups.map(([a, b]) => [a, b].sort().join('|')));
    for (const [a, b] of neighbor.matchups) {
      if (currPairs.has([a, b].sort().join('|'))) return true;
    }
  }
  return false;
}

/**
 * Check for max-repeat violations in the final schedule.
 */
function checkMaxRepeat(schedule, maxRepeat, violations, teamIds) {
  const counts = {};
  for (const id of teamIds) {
    counts[id] = {};
    for (const id2 of teamIds) {
      if (id !== id2) counts[id][id2] = 0;
    }
  }

  for (const week of schedule) {
    for (const [a, b] of week.matchups) {
      counts[a][b]++;
      counts[b][a]++;
    }
  }

  const reported = new Set();
  for (const a of teamIds) {
    for (const b of teamIds) {
      if (a >= b) continue;
      const key = `${a}|${b}`;
      if (counts[a][b] > maxRepeat && !reported.has(key)) {
        reported.add(key);
        violations.push({
          type: 'max-repeat',
          message: `${a} vs ${b} play ${counts[a][b]} times (max allowed: ${maxRepeat})`,
        });
      }
    }
  }
}
