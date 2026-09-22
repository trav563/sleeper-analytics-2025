import { completedStandings } from './completedStandings.js';

export const formatRecord = ({ wins = 0, losses = 0, ties = 0 } = {}) => `${wins}-${losses}${ties ? `-${ties}` : ''}`;
export const medianEnabled = league => Number(league?.settings?.league_average_match) === 1;
export function medianScore(scores) {
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length ? sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 : null;
}
const emptyRecord = () => ({ wins: 0, losses: 0, ties: 0 });
const addResult = (record, score, opponent) => {
    if (score > opponent) record.wins++;
    else if (score < opponent) record.losses++;
    else record.ties++;
};

/** Input contains completed weeks only. Records count results; production counts weeks. */
export function leagueRecords(rosters = [], weeks = {}, league = {}) {
    rosters ||= []; weeks ||= {}; league ||= {};
    const start = Number(league.settings?.start_week) || 1;
    const end = Number(league.settings?.playoff_week_start) || 19;
    const regular = Object.fromEntries(Object.entries(weeks).filter(([w]) => Number(w) >= start && Number(w) < end));
    const last = Math.max(0, ...Object.keys(regular).map(Number));
    for (let week = start; week <= last; week++) regular[week] ||= [];
    const ids = new Set(rosters.map(r => r.roster_id));
    const incompleteWeeks = Object.entries(regular).filter(([, rows]) => !Array.isArray(rows)
        || rows.length !== ids.size || new Set(rows.map(r => r.roster_id)).size !== ids.size
        || rows.some(r => !ids.has(r.roster_id) || !Number.isFinite(r.points))).map(([w]) => Number(w));
    const medianRecords = Object.fromEntries(rosters.map(r => [r.roster_id, emptyRecord()]));
    if (medianEnabled(league)) for (const [week, rows] of Object.entries(regular)) {
        if (incompleteWeeks.includes(Number(week))) continue;
        const median = medianScore(rows.map(r => r.points));
        for (const row of rows) addResult(medianRecords[row.roster_id], row.points, median);
    }
    const throughWeek = Math.max(0, ...Object.keys(regular).map(Number));
    return completedStandings(rosters, regular).map(stat => {
        const headToHead = { wins: stat.wins, losses: stat.losses, ties: stat.ties };
        const median = medianRecords[stat.rosterId];
        const combined = Object.fromEntries(['wins', 'losses', 'ties'].map(k => [k, headToHead[k] + median[k]]));
        const recordGames = combined.wins + combined.losses + combined.ties;
        return { ...stat, ...combined, headToHead, median, combined, weeksPlayed: stat.gamesPlayed,
            recordGames, throughWeek, incompleteWeeks, complete: incompleteWeeks.length === 0,
            winPct: recordGames ? (combined.wins + combined.ties / 2) / recordGames : 0,
            record: formatRecord(combined) };
    });
}

export function scheduleLuck(stat) {
    const h = stat.headToHead || stat;
    const games = h.wins + h.losses + h.ties;
    return h.wins + h.ties / 2 - stat.apWinPct * games;
}
