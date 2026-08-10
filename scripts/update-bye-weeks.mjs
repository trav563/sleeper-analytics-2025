// Regenerates src/data/byeWeeks.json from nflverse's games dataset.
// Run: npm run update-byes  (re-run when a new NFL schedule is released)
//
// Source: https://github.com/nflverse/nfldata (games.csv, updated in-season).
// A team is on bye in a regular-season week if it appears in no game that week.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAMES_CSV = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const FROM_SEASON = 2024;

// nflverse -> Sleeper team code differences
const TEAM_FIX = { LA: 'LAR', WSH: 'WAS', OAK: 'LV', SD: 'LAC', STL: 'LAR' };
const fix = (t) => TEAM_FIX[t] || t;

const res = await fetch(GAMES_CSV);
if (!res.ok) throw new Error(`Failed to fetch games.csv: ${res.status}`);
const csv = await res.text();

const lines = csv.trim().split('\n');
const header = lines[0].split(',');
const col = (name) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Missing column ${name}`);
    return i;
};
const [iSeason, iType, iWeek, iAway, iHome] =
    ['season', 'game_type', 'week', 'away_team', 'home_team'].map(col);

// season -> week -> Set(teams playing)
const playing = {};
// season -> Set(all teams that appear at all)
const teamsBySeason = {};

for (const line of lines.slice(1)) {
    const f = line.split(',');
    const season = Number(f[iSeason]);
    if (season < FROM_SEASON || f[iType] !== 'REG') continue;
    const week = Number(f[iWeek]);
    const away = fix(f[iAway]);
    const home = fix(f[iHome]);
    ((playing[season] ??= {})[week] ??= new Set()).add(away);
    playing[season][week].add(home);
    (teamsBySeason[season] ??= new Set()).add(away);
    teamsBySeason[season].add(home);
}

const byeWeeks = {};
for (const [season, weeks] of Object.entries(playing)) {
    const allTeams = [...teamsBySeason[season]].sort();
    byeWeeks[season] = {};
    for (const [week, teams] of Object.entries(weeks)) {
        const byes = allTeams.filter((t) => !teams.has(t));
        // Only meaningful bye windows — every team "misses" unplayed future
        // data rows equally, but games.csv lists the full schedule up front,
        // so any non-empty diff here is a real bye.
        if (byes.length > 0 && byes.length < allTeams.length) {
            byeWeeks[season][week] = byes;
        }
    }
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'byeWeeks.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(byeWeeks, null, 2) + '\n');
console.log(`Wrote ${outPath}:`,
    Object.entries(byeWeeks).map(([s, w]) => `${s} (${Object.keys(w).length} bye weeks)`).join(', '));
