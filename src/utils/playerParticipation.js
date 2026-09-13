import { scoreStatLine, projectedPoints } from './scoring.js';

export function didParticipate(stats) {
    if (!stats) return false;
    if (stats.gp != null) return stats.gp > 0;
    return ['off_snp', 'def_snp', 'st_snp', 'pass_att', 'rush_att', 'targets', 'rec', 'fgm', 'fga', 'xpa', 'xpm', 'def_st_tkl', 'pts_allow', 'yds_allow']
        .some(key => Number(stats[key]) > 0);
}

export function playerGameLogs(weeks, scoringSettings) {
    const logs = {};
    for (const [week, players] of Object.entries(weeks || {})) {
        for (const [id, stats] of Object.entries(players || {})) {
            if (!didParticipate(stats)) continue;
            const points = scoreStatLine(stats, scoringSettings) ?? projectedPoints(stats, scoringSettings);
            (logs[id] ||= []).push({ week: Number(week), points });
        }
    }
    for (const log of Object.values(logs)) log.sort((a, b) => a.week - b.week);
    return logs;
}

/** Aggregate only participation-confirmed, completed weekly stat lines. */
export function aggregateCompletedStats(weeks, scoringSettings) {
    const totals = {};
    for (const players of Object.values(weeks || {})) for (const [id, stats] of Object.entries(players || {})) {
        if (!didParticipate(stats)) continue;
        const entry = totals[id] ||= { gp: 0, leaguePoints: 0 };
        entry.gp++;
        entry.leaguePoints += projectedPoints(stats, scoringSettings);
        for (const [key, value] of Object.entries(stats)) if (key !== 'gp' && typeof value === 'number') entry[key] = (entry[key] || 0) + value;
    }
    return totals;
}
