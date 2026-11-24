/**
 * Perfect weeks across league history.
 *
 * A "perfect week" is a team-week where the actual score equals the maximum score
 * obtainable from the players on that roster that week — the manager started exactly
 * the right nine. This is what Sleeper's weekly report calls a maxed-out lineup.
 *
 * Reuses the app's exact optimal-lineup solver (src/utils/lineupAssignment.js) so the
 * numbers agree with what the app already shows for bench points and max PF.
 *
 * Usage:  node research/perfect-weeks/perfect-weeks.mjs [currentLeagueId]
 * Writes: research/perfect-weeks/perfect-weeks.csv   (one row per team-week)
 *         research/perfect-weeks/summary.json        (tallies + perfect-week detail)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assignLineup } from '../../src/utils/lineupAssignment.js';

const BASE = 'https://api.sleeper.app/v1';
const DEFAULT_LEAGUE_ID = '1312087088669151232'; // 12 Guys 1 Cup, 2026
const MAX_WEEK = 17; // league's last scheduled week; week 18 has no matchups
const OUT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PLAYERS_CACHE = path.join(os.tmpdir(), 'sleeper-players-nfl.json');
const PLAYERS_TTL_MS = 24 * 60 * 60 * 1000;
const EPSILON = 0.005; // points are reported to the cent

async function getJson(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(url);
        if (res.ok) return res.json();
        if (res.status < 500 && res.status !== 429) throw new Error(`${res.status} ${url}`);
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
    throw new Error(`failed after retries: ${url}`);
}

async function loadPlayers() {
    const fresh = fs.existsSync(PLAYERS_CACHE) && Date.now() - fs.statSync(PLAYERS_CACHE).mtimeMs < PLAYERS_TTL_MS;
    if (fresh) return JSON.parse(fs.readFileSync(PLAYERS_CACHE, 'utf8'));
    const players = await getJson(`${BASE}/players/nfl`);
    fs.writeFileSync(PLAYERS_CACHE, JSON.stringify(players));
    return players;
}

/** Walk previous_league_id back to the first season. Returns newest-first. */
async function loadChain(leagueId) {
    const chain = [];
    const visited = new Set();
    let id = leagueId;
    while (id && !visited.has(id) && visited.size < 20) {
        visited.add(id);
        const league = await getJson(`${BASE}/league/${id}`);
        if (!league) break;
        chain.push(league);
        id = league.previous_league_id;
    }
    return chain;
}

const round2 = n => Math.round(n * 100) / 100;
const sum = xs => xs.reduce((a, b) => a + b, 0);

function main() {
    return run().catch(err => {
        console.error(err);
        process.exitCode = 1;
    });
}

async function run() {
    const leagueId = process.argv[2] || DEFAULT_LEAGUE_ID;
    const [players, chain] = await Promise.all([loadPlayers(), loadChain(leagueId)]);
    console.log(`Players loaded: ${Object.keys(players).length}`);
    console.log(`Seasons: ${chain.map(l => l.season).join(', ')}\n`);

    const rows = [];
    const unknownIds = new Set();
    const reconciliation = [];

    for (const league of chain) {
        const slots = league.roster_positions || [];
        const regularSeasonEnd = (league.settings?.playoff_week_start || 15) - 1;
        const [rosters, users] = await Promise.all([
            getJson(`${BASE}/league/${league.league_id}/rosters`),
            getJson(`${BASE}/league/${league.league_id}/users`),
        ]);
        const userById = Object.fromEntries((users || []).map(u => [u.user_id, u]));
        const ownerByRoster = Object.fromEntries((rosters || []).map(r => [r.roster_id, r.owner_id]));

        let weeksCounted = 0;
        for (let week = 1; week <= MAX_WEEK; week++) {
            const matchups = await getJson(`${BASE}/league/${league.league_id}/matchups/${week}`);
            if (!matchups?.length) continue;
            // An unplayed week returns rosters with every score at zero. Skip it.
            if (!matchups.some(m => (m.points || 0) > 0)) continue;
            weeksCounted++;

            for (const m of matchups) {
                const pointsByPlayer = m.players_points || {};
                const starters = (m.starters || []).filter(pid => pid && pid !== '0');
                const starterPoints = (m.starters_points || []).map(p => (Number.isFinite(p) ? p : null));
                if (starterPoints.some(p => p === null)) continue;

                const actual = round2(sum(starterPoints));
                const reported = round2(m.points || 0);

                const roster = m.players || Object.keys(pointsByPlayer);
                for (const pid of roster) if (!players[pid]) unknownIds.add(pid);
                const pool = roster
                    .filter(pid => players[pid] && Number.isFinite(pointsByPlayer[pid]))
                    .map(pid => ({ ...players[pid], id: pid, points: pointsByPlayer[pid] }));

                const { assignments, total, filled } = assignLineup(slots, pool, p => p.points);
                const optimal = round2(total);
                const startedSet = new Set(starters);
                const benchBest = pool
                    .filter(p => !startedSet.has(p.id))
                    .sort((a, b) => b.points - a.points)[0] || null;

                const owner = userById[ownerByRoster[m.roster_id]];
                const lineup = Object.entries(assignments)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([index, p]) => ({
                        slot: slots[Number(index)],
                        name: p ? (p.full_name || p.id) : null,
                        position: p?.position ?? null,
                        points: p ? round2(p.points) : null,
                    }));

                rows.push({
                    season: league.season,
                    week,
                    rosterId: m.roster_id,
                    ownerId: ownerByRoster[m.roster_id] || null,
                    manager: owner?.display_name || `roster ${m.roster_id}`,
                    team: owner?.metadata?.team_name || owner?.display_name || `Team ${m.roster_id}`,
                    actual,
                    optimal,
                    left: round2(optimal - actual),
                    perfect: Math.abs(optimal - actual) < EPSILON,
                    regularSeason: week <= regularSeasonEnd,
                    hadRealOpponent: m.matchup_id != null,
                    slotsFilled: filled,
                    expectedSlots: slots.filter(s => !['BN', 'IR', 'TAXI'].includes(s)).length,
                    reportedMismatch: Math.abs(actual - reported) >= 0.011,
                    benchBest: benchBest ? { name: benchBest.full_name || benchBest.id, position: benchBest.position, points: round2(benchBest.points) } : null,
                    lineup,
                });
            }
        }

        // Reconciliation gate: regular-season sums must reproduce Sleeper's own stored totals.
        for (const r of rosters || []) {
            const mine = rows.filter(x => x.season === league.season && x.rosterId === r.roster_id && x.regularSeason);
            if (!mine.length) continue;
            const ppts = (r.settings?.ppts || 0) + (r.settings?.ppts_decimal || 0) / 100;
            const fpts = (r.settings?.fpts || 0) + (r.settings?.fpts_decimal || 0) / 100;
            reconciliation.push({
                season: league.season,
                rosterId: r.roster_id,
                manager: userById[r.owner_id]?.display_name || `roster ${r.roster_id}`,
                optimalSum: round2(sum(mine.map(x => x.optimal))),
                ppts: round2(ppts),
                optimalDiff: round2(sum(mine.map(x => x.optimal)) - ppts),
                actualSum: round2(sum(mine.map(x => x.actual))),
                fpts: round2(fpts),
                actualDiff: round2(sum(mine.map(x => x.actual)) - fpts),
            });
        }
        console.log(`${league.season}: ${weeksCounted} scored weeks, ${rows.filter(r => r.season === league.season).length} team-weeks`);
    }

    report(rows, reconciliation, unknownIds);
    writeOutputs(rows, reconciliation);
}

function report(rows, reconciliation, unknownIds) {
    const perfect = rows.filter(r => r.perfect);
    const slotProblems = rows.filter(r => r.slotsFilled !== r.expectedSlots);
    const reportedMismatches = rows.filter(r => r.reportedMismatch);

    console.log(`\n=== Reconciliation vs Sleeper's stored regular-season totals ===`);
    const bySeasonRecon = {};
    for (const r of reconciliation) {
        bySeasonRecon[r.season] ??= [];
        if (Math.abs(r.optimalDiff) >= 0.011 || Math.abs(r.actualDiff) >= 0.011) bySeasonRecon[r.season].push(r);
    }
    for (const season of Object.keys(bySeasonRecon).sort().reverse()) {
        const bad = bySeasonRecon[season];
        if (!bad.length) { console.log(`  ${season}: clean (all 12 rosters match ppts and fpts)`); continue; }
        console.log(`  ${season}: ${bad.length} roster(s) diverge`);
        for (const r of bad) {
            const optOff = Math.abs(r.optimalDiff) >= 0.011;
            const actOff = Math.abs(r.actualDiff) >= 0.011;
            const kind = !optOff ? 'stored fpts drift only; our optimal matches ppts exactly'
                : !actOff && r.optimalDiff > 0 ? 'our max exceeds ppts — unstartable player in the pool, see README caveat'
                : !actOff ? 'our max is below ppts — stored ppts drift'
                : Math.abs(r.optimalDiff - r.actualDiff) < 0.011 ? 'stat-correction drift (actual and optimal shifted equally)'
                : 'mixed drift (actual and optimal shifted by different amounts)';
            console.log(`    r${r.rosterId} ${r.manager}: optimal ${r.optimalSum} vs ppts ${r.ppts} (${r.optimalDiff >= 0 ? '+' : ''}${r.optimalDiff}), actual ${r.actualSum} vs fpts ${r.fpts} (${r.actualDiff >= 0 ? '+' : ''}${r.actualDiff}) — ${kind}`);
        }
    }

    console.log(`\n=== Data integrity ===`);
    console.log(`  team-weeks analysed:            ${rows.length}`);
    console.log(`  unresolved player ids:          ${unknownIds.size}${unknownIds.size ? ' -> ' + [...unknownIds].join(', ') : ''}`);
    console.log(`  lineups that could not be filled: ${slotProblems.length}`);
    console.log(`  points != sum(starters_points): ${reportedMismatches.length}`);

    console.log(`\n=== PERFECT WEEKS: ${perfect.length} in ${rows.length} team-weeks (${(100 * perfect.length / rows.length).toFixed(1)}%) ===`);
    console.log(`  regular season only:  ${perfect.filter(p => p.regularSeason).length}`);
    console.log(`  playoff/consolation:  ${perfect.filter(p => !p.regularSeason).length}`);
    console.log(`  with a real opponent: ${perfect.filter(p => p.hadRealOpponent).length}`);

    console.log(`\nBy manager:`);
    const byManager = {};
    for (const p of perfect) { byManager[p.manager] ??= []; byManager[p.manager].push(p); }
    for (const [manager, list] of Object.entries(byManager).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
        console.log(`  ${String(list.length).padStart(2)}  ${manager}  (${list.map(p => `${p.season} wk${p.week}`).join(', ')})`);
    }

    console.log(`\nBy season:`);
    const bySeason = {};
    for (const p of perfect) bySeason[p.season] = (bySeason[p.season] || 0) + 1;
    for (const season of [...new Set(rows.map(r => r.season))].sort().reverse()) {
        const teamWeeks = rows.filter(r => r.season === season).length;
        console.log(`  ${season}: ${bySeason[season] || 0} (of ${teamWeeks} team-weeks)`);
    }

    console.log(`\nEvery perfect week:`);
    for (const p of [...perfect].sort((a, b) => a.season.localeCompare(b.season) || a.week - b.week)) {
        console.log(`  ${p.season} wk${String(p.week).padStart(2)}  ${p.actual.toFixed(2).padStart(7)}  ${p.manager} — ${p.team}${p.hadRealOpponent ? '' : '  [no opponent that week]'}`);
        console.log(`      started: ${p.lineup.map(s => `${s.slot} ${s.name ?? '(empty)'} ${s.points ?? 0}`).join(' | ')}`);
        console.log(`      best left on bench: ${p.benchBest ? `${p.benchBest.name} (${p.benchBest.position}) ${p.benchBest.points}` : 'none'}`);
    }

    const nearMiss = rows.filter(r => !r.perfect && r.left <= 1).sort((a, b) => a.left - b.left);
    console.log(`\nNear misses (within 1.00 point): ${nearMiss.length}`);
    for (const r of nearMiss) {
        console.log(`  -${r.left.toFixed(2)}  ${r.season} wk${String(r.week).padStart(2)}  ${r.manager}  ${r.actual.toFixed(2)} of ${r.optimal.toFixed(2)}`);
    }
}

/** RFC 4180 field: quote when needed, escape quotes by doubling. Team names contain commas. */
const csvField = value => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function writeOutputs(rows, reconciliation) {
    const header = ['season', 'week', 'rosterId', 'manager', 'team', 'actual', 'optimal', 'left', 'perfect', 'regularSeason', 'hadRealOpponent', 'benchBestName', 'benchBestPoints'];
    const csv = [header.join(',')];
    for (const r of rows) {
        csv.push([
            r.season, r.week, r.rosterId, r.manager, r.team,
            r.actual.toFixed(2), r.optimal.toFixed(2), r.left.toFixed(2), r.perfect, r.regularSeason, r.hadRealOpponent,
            r.benchBest?.name ?? '', r.benchBest ? r.benchBest.points.toFixed(2) : '',
        ].map(csvField).join(','));
    }
    fs.writeFileSync(path.join(OUT_DIR, 'perfect-weeks.csv'), csv.join('\n') + '\n');

    const perfect = rows.filter(r => r.perfect);
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({
        generatedAt: new Date().toISOString(),
        teamWeeks: rows.length,
        perfectCount: perfect.length,
        perfect,
        nearMisses: rows.filter(r => !r.perfect && r.left <= 1).sort((a, b) => a.left - b.left),
        reconciliation,
    }, null, 2) + '\n');

    console.log(`\nWrote perfect-weeks.csv (${rows.length} rows) and summary.json`);
}

main();
