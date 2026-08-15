/**
 * Pre-generation constraint feasibility checks.
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 */

export function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const { teams, weeks, maxRepeat, noBackToBack, divisions, rivalryWeek, lockedWeeks } = config;

  const teamCount = teams.length;

  // Basic sanity
  if (teamCount < 2) {
    errors.push('Need at least 2 teams to generate a schedule.');
    return { valid: false, errors, warnings };
  }

  if (weeks < 1) {
    errors.push('Season must be at least 1 week.');
    return { valid: false, errors, warnings };
  }

  // Max repeat feasibility
  const maxPossibleOpponents = teamCount - 1;
  if (maxRepeat < 1) {
    errors.push('Max repeat must be at least 1.');
  }

  if (maxRepeat === 1 && weeks > maxPossibleOpponents) {
    errors.push(
      `With ${teamCount} teams and max 1 matchup per pair, the longest season possible is ${maxPossibleOpponents} weeks. ` +
      `Either increase max repeat or reduce season length.`
    );
  }

  const minRepeatNeeded = Math.ceil(weeks / maxPossibleOpponents);
  if (maxRepeat < minRepeatNeeded) {
    errors.push(
      `${weeks} weeks with ${teamCount} teams requires each pair to play at least ${minRepeatNeeded} times. ` +
      `Increase max repeat to at least ${minRepeatNeeded}.`
    );
  }

  // Division validation
  if (divisions && divisions.enabled) {
    const { groups, intraGames, interGames } = divisions;

    if (!groups || groups.length < 2) {
      errors.push('Divisions require at least 2 groups.');
    } else {
      // Check all teams are assigned
      const assignedTeamIds = new Set(groups.flatMap(g => g.teamIds));
      const allTeamIds = new Set(teams.map(t => t.id));

      const unassigned = teams.filter(t => !assignedTeamIds.has(t.id));
      if (unassigned.length > 0) {
        errors.push(`${unassigned.length} team(s) not assigned to a division.`);
      }

      const extra = [...assignedTeamIds].filter(id => !allTeamIds.has(id));
      if (extra.length > 0) {
        errors.push(`${extra.length} unknown team(s) in division assignments.`);
      }

      // Check empty divisions
      const emptyDivs = groups.filter(g => !g.teamIds || g.teamIds.length === 0);
      if (emptyDivs.length > 0) {
        errors.push(`${emptyDivs.length} division(s) have no teams.`);
      }

      // Check game count math for each team
      if (intraGames != null && interGames != null && groups.length > 0 && unassigned.length === 0) {
        for (const group of groups) {
          const divSize = group.teamIds.length;
          const intraPairs = divSize - 1;
          const interPairs = teamCount - divSize;
          const totalGames = intraGames * intraPairs + interGames * interPairs;

          if (totalGames !== weeks) {
            errors.push(
              `Division "${group.name || 'unnamed'}": ${intraGames} intra-division games x ${intraPairs} divisional opponents + ` +
              `${interGames} inter-division games x ${interPairs} other opponents = ${totalGames} games, ` +
              `but season is ${weeks} weeks.`
            );
            break; // One error is enough to show the math doesn't work
          }
        }

        // Check max repeat against division games
        if (intraGames > maxRepeat) {
          errors.push(
            `Intra-division games (${intraGames}) exceeds max repeat (${maxRepeat}).`
          );
        }
        if (interGames > maxRepeat) {
          errors.push(
            `Inter-division games (${interGames}) exceeds max repeat (${maxRepeat}).`
          );
        }
      }
    }
  }

  // Rivalry week validation
  if (rivalryWeek && rivalryWeek.enabled) {
    if (rivalryWeek.week < 1 || rivalryWeek.week > weeks) {
      errors.push(`Rivalry week ${rivalryWeek.week} is outside the season (weeks 1-${weeks}).`);
    }
    const rivalryResult = validateLockedMatchups(rivalryWeek, teams, 'Rivalry week');
    errors.push(...rivalryResult.errors);
    warnings.push(...rivalryResult.warnings);
  }

  // Locked weeks validation
  if (lockedWeeks && lockedWeeks.length > 0) {
    const usedWeeks = new Set();

    if (rivalryWeek?.enabled) {
      usedWeeks.add(rivalryWeek.week);
    }

    for (const lw of lockedWeeks) {
      if (lw.week < 1 || lw.week > weeks) {
        errors.push(`Locked week ${lw.week} is outside the season (weeks 1-${weeks}).`);
        continue;
      }

      if (usedWeeks.has(lw.week)) {
        errors.push(`Week ${lw.week} is assigned to multiple locked/rivalry weeks.`);
      }
      usedWeeks.add(lw.week);

      const lwResult = validateLockedMatchups(lw, teams, `Locked week ${lw.week}`);
      errors.push(...lwResult.errors);
      warnings.push(...lwResult.warnings);
    }

    // Check adjacent locked weeks for back-to-back conflicts
    if (noBackToBack) {
      const allFixed = [];
      if (rivalryWeek?.enabled && rivalryWeek.matchups) {
        allFixed.push({ week: rivalryWeek.week, matchups: rivalryWeek.matchups });
      }
      for (const lw of lockedWeeks) {
        if (lw.matchups) {
          allFixed.push({ week: lw.week, matchups: lw.matchups });
        }
      }

      allFixed.sort((a, b) => a.week - b.week);

      for (let i = 0; i < allFixed.length - 1; i++) {
        const curr = allFixed[i];
        const next = allFixed[i + 1];
        if (next.week - curr.week === 1) {
          // Check for shared matchups
          const currPairs = pairsFromMatchups(curr.matchups);
          const nextPairs = pairsFromMatchups(next.matchups);
          const shared = currPairs.filter(p => nextPairs.some(np => samePair(p, np)));
          if (shared.length > 0) {
            const pairStrs = shared.map(p => `${p[0]} vs ${p[1]}`).join(', ');
            warnings.push(
              `Weeks ${curr.week} and ${next.week} are adjacent and share matchup(s): ${pairStrs}. ` +
              `This conflicts with the back-to-back constraint.`
            );
          }
        }
      }
    }

    // Warn if too many weeks are locked
    const totalFixed = (rivalryWeek?.enabled ? 1 : 0) + lockedWeeks.length;
    if (totalFixed > weeks / 2) {
      warnings.push(
        `${totalFixed} of ${weeks} weeks are locked. This heavily constrains the algorithm and may limit schedule quality.`
      );
    }
  }

  // Small league warnings
  if (noBackToBack && teamCount <= 6) {
    warnings.push(
      `With only ${teamCount} teams, the back-to-back constraint may be difficult to satisfy for longer seasons.`
    );
  }

  // Odd teams info
  if (teamCount % 2 !== 0) {
    warnings.push(
      `Odd number of teams (${teamCount}). One team will have a bye each week.`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateLockedMatchups(weekConfig, teams, label) {
  const errors = [];
  const warnings = [];
  const { matchups } = weekConfig;

  if (!matchups || matchups.length === 0) {
    errors.push(`${label} has no matchups assigned.`);
    return { errors, warnings };
  }

  const expectedMatchups = Math.floor(teams.length / 2);
  if (matchups.length < expectedMatchups) {
    const unassignedCount = (expectedMatchups - matchups.length) * 2;
    errors.push(`${label} has ${unassignedCount} unassigned team(s).`);
  }

  // Check for duplicate team assignments within the week
  const validIds = new Set(teams.map(t => t.id));
  const usedTeams = new Set();
  for (const m of matchups) {
    if (!m.teamA || !m.teamB) {
      errors.push(`${label} has an incomplete matchup.`);
      continue;
    }
    // Stale saved configs can reference rosters no longer in the league;
    // the generator would throw on them (counts[a] is undefined).
    for (const id of [m.teamA, m.teamB]) {
      if (!validIds.has(id)) {
        errors.push(`${label} references a team that is no longer in the league.`);
      }
    }
    if (m.teamA === m.teamB) {
      errors.push(`${label} has a team matched against itself.`);
    }
    if (usedTeams.has(m.teamA)) {
      errors.push(`${label} has a team assigned to multiple matchups.`);
    }
    if (usedTeams.has(m.teamB)) {
      errors.push(`${label} has a team assigned to multiple matchups.`);
    }
    usedTeams.add(m.teamA);
    usedTeams.add(m.teamB);
  }

  return { errors, warnings };
}

/**
 * Post-generation structural integrity check on a FORMATTED schedule
 * ({ week, matchups: [{teamA, teamB}], byes }). Pure and throw-free, so it can
 * run on fresh generator output and on results rehydrated from localStorage.
 *
 * The core invariant — every team id appears exactly once per week across
 * matchups + byes — subsumes duplicate teams, missing teams, wrong matchup
 * counts, unknown ids, and bye correctness for even and odd leagues.
 *
 * @param {Array} schedule formatted weeks
 * @param {{teamIds: string[], weeks?: number, fixedWeeks?: Map<number, {matchups: Array}>}} opts
 * @returns {Array<{type: 'integrity', message: string}>}
 */
export function validateScheduleIntegrity(schedule, { teamIds, weeks, fixedWeeks } = {}) {
  const violations = [];
  const push = (message) => violations.push({ type: 'integrity', message });

  if (!Array.isArray(schedule) || !Array.isArray(teamIds) || teamIds.length === 0) {
    push('Schedule or team list is missing.');
    return violations;
  }

  if (weeks != null && schedule.length !== weeks) {
    push(`Schedule has ${schedule.length} weeks, expected ${weeks}.`);
  }

  const idSet = new Set(teamIds);
  for (const weekData of schedule) {
    const label = `Week ${weekData?.week}`;
    const seen = new Map(); // id -> count
    const record = (id) => seen.set(id, (seen.get(id) || 0) + 1);

    for (const m of weekData?.matchups || []) {
      if (!m || m.teamA == null || m.teamB == null) {
        push(`${label} has an incomplete matchup.`);
        continue;
      }
      if (m.teamA === m.teamB) push(`${label} has a team matched against itself.`);
      record(m.teamA);
      record(m.teamB);
    }
    for (const id of weekData?.byes || []) record(id);

    for (const [id, count] of seen) {
      if (!idSet.has(id)) push(`${label} references unknown team ${id}.`);
      else if (count > 1) push(`${label} has team ${id} in ${count} matchups.`);
    }
    for (const id of idSet) {
      if (!seen.has(id)) push(`${label} is missing team ${id}.`);
    }
  }

  // Fixed (rivalry/locked) weeks must survive generation exactly as configured.
  // fw.matchups may be [a, b] pairs (algorithm-internal) or {teamA, teamB}.
  if (fixedWeeks) {
    for (const [weekNum, fw] of fixedWeeks) {
      const out = schedule.find(w => w?.week === weekNum);
      if (!out) continue; // length mismatch already reported
      const wanted = new Set(
        (fw.matchups || [])
          .map(m => (Array.isArray(m) ? m : [m?.teamA, m?.teamB]))
          .filter(([a, b]) => a && b)
          .map(([a, b]) => [a, b].sort().join('|'))
      );
      const got = new Set(
        (out.matchups || [])
          .filter(m => m?.teamA && m?.teamB)
          .map(m => [m.teamA, m.teamB].sort().join('|'))
      );
      const same = wanted.size === got.size && [...wanted].every(p => got.has(p));
      if (!same) push(`Week ${weekNum} no longer matches its locked/rivalry matchups.`);
    }
  }

  return violations;
}

function pairsFromMatchups(matchups) {
  if (!matchups) return [];
  return matchups
    .filter(m => m.teamA && m.teamB)
    .map(m => [m.teamA, m.teamB].sort());
}

function samePair(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}
