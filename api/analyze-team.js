import { GoogleGenerativeAI } from '@google/generative-ai';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

// ── Rate Limiting (in-memory, per serverless instance) ──
const rateLimitMap = new Map();
const RATE_LIMIT_PER_DAY = 10;
const RATE_LIMIT_PER_HOUR = 3;

function checkRateLimit(userId) {
    const now = Date.now();
    const key = `rate:${userId}`;
    let entry = rateLimitMap.get(key);
    if (!entry) { entry = { hourly: [], daily: [] }; rateLimitMap.set(key, entry); }
    entry.hourly = entry.hourly.filter(t => t > now - 3600000);
    entry.daily = entry.daily.filter(t => t > now - 86400000);
    if (entry.daily.length >= RATE_LIMIT_PER_DAY)
        return { allowed: false, reason: 'Daily limit reached (10/day). Try again tomorrow.', remaining: 0 };
    if (entry.hourly.length >= RATE_LIMIT_PER_HOUR)
        return { allowed: false, reason: 'Hourly limit reached (3/hour). Try again shortly.', remaining: RATE_LIMIT_PER_DAY - entry.daily.length };
    entry.hourly.push(now);
    entry.daily.push(now);
    return { allowed: true, remaining: RATE_LIMIT_PER_DAY - entry.daily.length };
}

// ── Simple in-memory cache for shared data (projections, stats) ──
// This survives across requests within the same serverless instance (~5-15 min on Vercel)
const dataCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function fetchCached(key, url) {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;
    const data = await fetchJSON(url);
    dataCache.set(key, { data, time: Date.now() });
    return data;
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} from ${url}`);
    return res.json();
}

// ── Helpers ──

function getScoringFormat(settings) {
    const recPts = settings?.rec ?? 0;
    if (recPts >= 1) return 'Full PPR (1.0 pts/rec)';
    if (recPts >= 0.5) return 'Half PPR (0.5 pts/rec)';
    return 'Standard (0 pts/rec)';
}

function describeScoringSettings(settings) {
    if (!settings) return '';
    const lines = [];
    if (settings.pass_yd) lines.push(`Passing: ${settings.pass_yd} pts/yd, ${settings.pass_td || 4} pts/TD, ${settings.pass_int || -1} pts/INT`);
    if (settings.rush_yd) lines.push(`Rushing: ${settings.rush_yd} pts/yd, ${settings.rush_td || 6} pts/TD`);
    if (settings.rec_yd) lines.push(`Receiving: ${settings.rec_yd} pts/yd, ${settings.rec_td || 6} pts/TD, ${settings.rec || 0} pts/rec`);
    if (settings.bonus_rec_te) lines.push(`TE Premium: +${settings.bonus_rec_te} pts/rec for TEs`);
    return lines.join('\n');
}

function describeRosterSlots(positions) {
    if (!positions) return 'Unknown';
    const counts = {};
    positions.forEach(pos => { counts[pos] = (counts[pos] || 0) + 1; });
    return Object.entries(counts)
        .map(([pos, count]) => {
            const label = pos === 'BN' ? 'Bench' : pos === 'SUPER_FLEX' ? 'Superflex' : pos;
            return count > 1 ? `${count} ${label}` : label;
        }).join(', ');
}

function pName(p) {
    if (!p) return 'Unknown';
    return `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function getStatsPPG(stats, pprField) {
    if (!stats) return null;
    const gp = stats.gp || 0;
    const pts = stats[pprField] ?? stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std ?? 0;
    if (gp === 0) return null;
    return { pts: pts, gp, ppg: (pts / gp).toFixed(1) };
}

function playerLine(pid, players, marketValues, currentStats, prevStats, weekProjections, pprField) {
    const p = players[pid];
    if (!p) return null;
    const name = pName(p);
    const pos = p.position || '?';
    const team = p.team || 'FA';
    const age = p.age || '?';
    const injury = p.injury_status || 'Healthy';
    const value = marketValues[pid] || 0;
    const depthOrder = p.depth_chart_order;
    const nflRole = depthOrder === 1 ? 'NFL Starter' : depthOrder === 2 ? 'NFL Backup' : depthOrder === 3 ? 'NFL 3rd' : '';

    // Current season stats
    const cur = getStatsPPG(currentStats?.[pid], pprField);
    let curStr = 'No 2025 stats yet';
    if (cur) curStr = `2025: ${cur.pts.toFixed(0)} pts, ${cur.gp} GP, ${cur.ppg} PPG`;

    // Previous season stats
    const prev = getStatsPPG(prevStats?.[pid], pprField);
    let prevStr = '';
    if (prev) prevStr = `2024: ${prev.pts.toFixed(0)} pts, ${prev.gp} GP, ${prev.ppg} PPG`;

    // This week's projection
    const proj = weekProjections?.[pid];
    let projStr = '';
    if (proj) {
        const projPts = proj[pprField] ?? proj.pts_ppr ?? 0;
        if (projPts > 0) projStr = `Proj: ${projPts.toFixed(1)}`;

        // Add positional rank from projections
        const posRank = proj.pos_rank_ppr ?? proj.pos_rank_half_ppr;
        if (posRank) projStr += ` (${pos}${posRank})`;
    }

    const statsLine = [curStr, prevStr, projStr].filter(Boolean).join(' | ');
    return { pid, name, pos, team, age, injury, value, nflRole, statsLine };
}

// ── Prompt Builder ──

function buildPrompt(data, analysisType) {
    const {
        league, userRoster, opponentRoster, players, users, rosters,
        freeAgents, matchups, transactions, week, marketValues,
        currentStats, prevStats, weekProjections, allMatchupHistory, pprField
    } = data;

    const settings = league.settings || {};
    const scoringFormat = getScoringFormat(settings);
    const rosterSlotDesc = describeRosterSlots(league.roster_positions);
    const scoringDetail = describeScoringSettings(settings);
    const isSuperflex = (league.roster_positions || []).includes('SUPER_FLEX');
    const numTeams = settings.num_teams || rosters.length;
    const rosterPositions = league.roster_positions || [];

    const slotCounts = {};
    rosterPositions.forEach(pos => {
        if (pos !== 'BN' && pos !== 'IR') slotCounts[pos] = (slotCounts[pos] || 0) + 1;
    });
    const startingSlotsDesc = Object.entries(slotCounts).map(([p, c]) => `${c}x ${p}`).join(', ');

    // ── User team ──
    const userOwner = users.find(u => u.user_id === userRoster.owner_id);
    const teamName = userOwner?.metadata?.team_name || userOwner?.display_name || userOwner?.username || 'My Team';
    const wins = userRoster.settings?.wins || 0;
    const losses = userRoster.settings?.losses || 0;
    const ties = userRoster.settings?.ties || 0;
    const record = `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
    const fpts = (userRoster.settings?.fpts || 0) + ((userRoster.settings?.fpts_decimal || 0) / 100);
    const gp = wins + losses + ties;
    const ppg = gp > 0 ? (fpts / gp).toFixed(1) : 'N/A (preseason)';

    // ── Standings ──
    const standings = [...rosters].sort((a, b) => {
        const aw = a.settings?.wins || 0, bw = b.settings?.wins || 0;
        if (aw !== bw) return bw - aw;
        return ((b.settings?.fpts || 0) + ((b.settings?.fpts_decimal || 0) / 100)) -
               ((a.settings?.fpts || 0) + ((a.settings?.fpts_decimal || 0) / 100));
    });
    const myRank = standings.findIndex(r => r.roster_id === userRoster.roster_id) + 1;

    const standingsText = standings.map((r, i) => {
        const o = users.find(u => u.user_id === r.owner_id);
        const name = o?.metadata?.team_name || o?.display_name || o?.username || `Team ${r.roster_id}`;
        const w = r.settings?.wins || 0, l = r.settings?.losses || 0;
        const pts = ((r.settings?.fpts || 0) + ((r.settings?.fpts_decimal || 0) / 100)).toFixed(1);
        const me = r.roster_id === userRoster.roster_id ? ' ← YOU' : '';
        return `${i + 1}. ${name} (${w}-${l}, ${pts} PF)${me}`;
    }).join('\n');

    // ── My roster mapped to lineup slots ──
    const starterIds = userRoster.starters || [];
    const allPlayerIds = userRoster.players || [];
    const benchIds = allPlayerIds.filter(pid => !starterIds.includes(pid));

    const makeRow = (pid) => playerLine(pid, players, marketValues, currentStats, prevStats, weekProjections, pprField);

    const starterLines = [];
    rosterPositions.forEach((slot, idx) => {
        if (slot === 'BN' || slot === 'IR') return;
        const pid = starterIds[idx];
        if (!pid || pid === '0') { starterLines.push(`| ${slot} | EMPTY SLOT | - | - | - | - | - | - |`); return; }
        const d = makeRow(pid);
        if (!d) return;
        starterLines.push(`| ${slot} | ${d.name} | ${d.pos} | ${d.team} | ${d.age} | ${d.injury} | ${d.nflRole} | ${d.statsLine} | ${d.value} |`);
    });

    const benchLines = benchIds.map(pid => {
        const d = makeRow(pid);
        if (!d) return null;
        return `| BN | ${d.name} | ${d.pos} | ${d.team} | ${d.age} | ${d.injury} | ${d.nflRole} | ${d.statsLine} | ${d.value} |`;
    }).filter(Boolean);

    // ── Opponent ──
    let opponentSection = 'No opponent data available for this week.';
    if (opponentRoster) {
        const oppOwner = users.find(u => u.user_id === opponentRoster.owner_id);
        const oppName = oppOwner?.metadata?.team_name || oppOwner?.display_name || oppOwner?.username || 'Opponent';
        const oppW = opponentRoster.settings?.wins || 0, oppL = opponentRoster.settings?.losses || 0;

        const oppLines = [];
        rosterPositions.forEach((slot, idx) => {
            if (slot === 'BN' || slot === 'IR') return;
            const pid = (opponentRoster.starters || [])[idx];
            if (!pid || pid === '0') { oppLines.push(`| ${slot} | EMPTY | - | - | - |`); return; }
            const d = makeRow(pid);
            if (!d) return;
            oppLines.push(`| ${slot} | ${d.name} | ${d.pos} | ${d.statsLine} | ${d.injury} |`);
        });

        opponentSection = `OPPONENT THIS WEEK: ${oppName} (Record: ${oppW}-${oppL})
| Slot | Player | Pos | Stats & Projection | Injury |
|------|--------|-----|--------------------|--------|
${oppLines.join('\n')}`;
    }

    // ── Other teams ──
    const leagueRostersText = rosters.filter(r => r.roster_id !== userRoster.roster_id).map(r => {
        const o = users.find(u => u.user_id === r.owner_id);
        const name = o?.metadata?.team_name || o?.display_name || o?.username || `Team ${r.roster_id}`;
        const w = r.settings?.wins || 0, l = r.settings?.losses || 0;
        const keyPlayers = (r.starters || []).filter(pid => pid && pid !== '0').map(pid => {
            const p = players[pid];
            if (!p) return null;
            const proj = weekProjections?.[pid];
            const projPts = proj ? (proj[pprField] ?? proj.pts_ppr ?? 0) : 0;
            const projStr = projPts > 0 ? ` [${projPts.toFixed(0)}p]` : '';
            return `${p.position}:${pName(p)}${projStr}`;
        }).filter(Boolean).join(', ');
        return `${name} (${w}-${l}): ${keyPlayers}`;
    }).join('\n');

    // ── Free agents with projections ──
    const topFA = freeAgents.slice(0, 25).map(pid => {
        const d = makeRow(pid);
        if (!d) return null;
        return `| ${d.pos} | ${d.name} | ${d.team} | ${d.nflRole} | ${d.statsLine} | ${d.value} |`;
    }).filter(Boolean);

    // ── Transactions ──
    const recentTx = (transactions || []).slice(0, 20).map(tx => {
        if (tx.type === 'trade') {
            const details = (tx.roster_ids || []).map(rid => {
                const r = rosters.find(r2 => r2.roster_id === rid);
                const owner = users.find(u => u.user_id === r?.owner_id);
                const tName = owner?.display_name || 'Unknown';
                const got = Object.entries(tx.adds || {}).filter(([, v]) => v === rid).map(([pid]) => {
                    const p = players[pid]; return p ? pName(p) : pid;
                });
                return got.length > 0 ? `${tName} gets ${got.join(', ')}` : null;
            }).filter(Boolean);
            return `- TRADE: ${details.join(' | ')}`;
        }
        const rosterOwner = users.find(u => {
            return rosters.find(r2 => tx.roster_ids?.includes(r2.roster_id) && r2.owner_id === u.user_id);
        });
        const adds = tx.adds ? Object.keys(tx.adds).map(pid => { const p = players[pid]; return p ? `+${pName(p)}` : `+${pid}`; }).join(', ') : '';
        const drops = tx.drops ? Object.keys(tx.drops).map(pid => { const p = players[pid]; return p ? `-${pName(p)}` : `-${pid}`; }).join(', ') : '';
        return `- ${tx.type}: ${rosterOwner?.display_name || '?'} | ${adds} ${drops}`.trim();
    });

    // ── Game log ──
    let matchupHistoryText = '';
    if (allMatchupHistory && Object.keys(allMatchupHistory).length > 0) {
        const weekScores = Object.entries(allMatchupHistory)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([w, wMatchups]) => {
                const my = wMatchups.find(m => m.roster_id === userRoster.roster_id);
                if (!my) return null;
                const opp = wMatchups.find(m => m.matchup_id === my.matchup_id && m.roster_id !== my.roster_id);
                const oppR = opp ? rosters.find(r => r.roster_id === opp.roster_id) : null;
                const oppO = oppR ? users.find(u => u.user_id === oppR.owner_id) : null;
                const oppName = oppO?.display_name || '?';
                const result = my.points > (opp?.points || 0) ? 'W' : my.points < (opp?.points || 0) ? 'L' : 'T';
                return `Wk${w}: ${my.points?.toFixed(1) || 0} vs ${oppName} (${opp?.points?.toFixed(1) || 0}) → ${result}`;
            }).filter(Boolean);
        if (weekScores.length > 0) matchupHistoryText = `\nMY GAME LOG:\n${weekScores.join('\n')}`;
    }

    // ── Instructions per analysis type ──
    const typeInstructions = {
        full: `Provide a comprehensive analysis with these exact sections:
## Roster Grade
Grade each position group A+ to F. Use the PROJECTION and STATS data provided — do not guess. A player projected as a top-5 at their position should be graded highly. Reference their actual PPG and projection numbers.
## This Week: Start/Sit
Recommend the OPTIMAL LINEUP filling every slot (${startingSlotsDesc}). Use each player's weekly projection (Proj column) as the primary factor. FLEX slots accept RB/WR/TE. SUPER_FLEX accepts QB/RB/WR/TE.
## Waiver Wire Targets
From the FREE AGENTS list, identify 3-5 high-value adds. Use their projections and positional rank. Suggest who to drop.
## Trade Opportunities
Suggest 2-3 realistic trades with OTHER teams. Reference specific players from their rosters. NEVER suggest acquiring a player already on MY roster.
## Outlook
Brief playoff path analysis based on standings, schedule, and roster strength.`,

        startsit: `## Optimal Lineup
Fill every starting slot (${startingSlotsDesc}). Use the "Proj" (weekly projection) as the PRIMARY factor for decisions.
- FLEX slots: RB/WR/TE eligible
- SUPER_FLEX slots: QB/RB/WR/TE eligible
- Maximize projected points — put the highest-projected eligible player in each slot
Show the full lineup with projected points for each player.

## Key Decisions
Explain only the close calls.`,

        waivers: `## Waiver Wire Targets
From the FREE AGENTS listed below. Use their projections, stats, and positional rank.
For each (5-7 recommendations):
- Player name, position, and their THIS WEEK projection
- Their season stats or last season stats
- Who to DROP from my roster
- Priority ranking`,

        trades: `## Trade Opportunities
Look at OTHER TEAMS' rosters. ALL players on MY ROSTER are already mine — NEVER suggest buying them.
- 2-3 specific proposals naming the team and exact players
- Use dynasty values and projections to ensure fairness
- Trade deadline: Week ${settings.trade_deadline || 11}`,

        playoff: `## Playoff Path
- Current: #${myRank} of ${numTeams} (${record})
- Playoffs: Top ${settings.playoff_teams || 6}, starting Week ${settings.playoff_week_start || 15}
- What record is needed
- Key remaining matchups
- Strategic advice`
    };

    const instructions = typeInstructions[analysisType] || typeInstructions.full;

    return `You are an expert fantasy football analyst. You have REAL DATA below — projections, stats, and rankings from this season. Use this data to make your analysis. Do NOT rely on prior assumptions about player quality — use the stats and projections provided.

CRITICAL RULES:
1. Players under "MY ROSTER" are ON MY TEAM. NEVER suggest acquiring them.
2. Use the "Proj" column (weekly projection points) as the primary factor for start/sit decisions.
3. Use "2025 stats" for current season performance and "2024 stats" for last year's context.
4. The "Lineup Slot" column shows the current slot assignment. FLEX=RB/WR/TE eligible. SUPER_FLEX=QB/RB/WR/TE eligible.
5. "NFL Role" shows NFL depth chart status. Weight this heavily.
6. "Dynasty Value" is from FantasyCalc (0-10,000 scale).
7. FREE AGENTS are unowned players available to add. Players on other teams require trades.
8. Reference specific stats and projections in your analysis. No guessing.

═══════════════════════════════════════
LEAGUE SETTINGS
═══════════════════════════════════════
League: ${league.name || 'Unknown'}
Format: ${scoringFormat}
${scoringDetail}
Starting Slots: ${startingSlotsDesc}
Full Roster: ${rosterSlotDesc}
Teams: ${numTeams} | Playoffs: Top ${settings.playoff_teams || 6}, Week ${settings.playoff_week_start || 15}
Trade Deadline: Week ${settings.trade_deadline || 11} | Current Week: ${week}
${isSuperflex ? '⚠ SUPERFLEX league — QBs are extra valuable.' : ''}

═══════════════════════════════════════
STANDINGS
═══════════════════════════════════════
${standingsText}

═══════════════════════════════════════
MY TEAM: ${teamName} (${record}, #${myRank}, ${ppg} PPG)
═══════════════════════════════════════

STARTERS:
| Slot | Player | Pos | Team | Age | Injury | NFL Role | Stats & Projection | Value |
|------|--------|-----|------|-----|--------|----------|---------------------|-------|
${starterLines.join('\n')}

BENCH:
| Slot | Player | Pos | Team | Age | Injury | NFL Role | Stats & Projection | Value |
|------|--------|-----|------|-----|--------|----------|---------------------|-------|
${benchLines.join('\n')}
${matchupHistoryText}

═══════════════════════════════════════
${opponentSection}
═══════════════════════════════════════

OTHER TEAMS (starters + this week projections):
${leagueRostersText}

═══════════════════════════════════════
FREE AGENTS (unowned, available to add):
| Pos | Player | Team | NFL Role | Stats & Projection | Value |
|-----|--------|------|----------|---------------------|-------|
${topFA.join('\n')}

RECENT TRANSACTIONS:
${recentTx.length > 0 ? recentTx.join('\n') : 'None.'}

═══════════════════════════════════════
${instructions}`;
}

// ── Handler ──

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

    const { leagueId, userId, week, analysisType = 'full' } = req.body;
    if (!leagueId || !userId || !week) return res.status(400).json({ error: 'Missing required fields' });

    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason, remaining: rateCheck.remaining });

    try {
        // Determine PPR field based on league settings (fetched first)
        const league = await fetchJSON(`${SLEEPER_BASE}/league/${leagueId}`);
        const settings = league.settings || {};
        const recPts = settings.rec ?? 0;
        const pprField = recPts >= 1 ? 'pts_ppr' : recPts >= 0.5 ? 'pts_half_ppr' : 'pts_std';
        const season = league.season || '2025';
        const prevSeason = String(Number(season) - 1);

        // Fetch all data in parallel — shared data uses cache
        const [rosters, users, matchups, nflPlayers, currentStats, prevStats, weekProjections] = await Promise.all([
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/rosters`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/users`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${week}`),
            fetchCached('players', `${SLEEPER_BASE}/players/nfl`),
            // Current season cumulative stats
            fetchCached(`stats-${season}`, `${SLEEPER_BASE}/stats/nfl/regular/${season}`).catch(() => ({})),
            // Previous season stats
            fetchCached(`stats-${prevSeason}`, `${SLEEPER_BASE}/stats/nfl/regular/${prevSeason}`).catch(() => ({})),
            // This week's projections (crucial for start/sit)
            fetchCached(`proj-${season}-${week}`, `${SLEEPER_BASE}/projections/nfl/regular/${season}/${week}`).catch(() => ({})),
        ]);

        // Transactions (current + prev week)
        let transactions = [];
        try {
            const [txCur, txPrev] = await Promise.all([
                fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week}`).catch(() => []),
                week > 1 ? fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week - 1}`).catch(() => []) : Promise.resolve([]),
            ]);
            transactions = [...(txCur || []), ...(txPrev || [])];
        } catch (e) { /* non-critical */ }

        // Past matchups for game log
        const pastPromises = [];
        for (let w = 1; w < week; w++) {
            pastPromises.push(fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${w}`).catch(() => null));
        }
        const pastMatchups = await Promise.all(pastPromises);
        const allMatchupHistory = {};
        pastMatchups.forEach((m, idx) => { if (m) allMatchupHistory[idx + 1] = m; });

        // Market values
        const isSuperflex = (league.roster_positions || []).includes('SUPER_FLEX');
        let marketValues = {};
        try {
            const numQbs = isSuperflex ? 2 : 1;
            const mvRes = await fetch(`${FANTASY_CALC_API}?isDynasty=true&numQbs=${numQbs}&numTeams=${settings.num_teams || rosters.length}&ppr=${recPts}`);
            if (mvRes.ok) {
                const mvData = await mvRes.json();
                mvData.forEach(p => { if (p.sleeperId) marketValues[p.sleeperId] = p.value; });
            }
        } catch (e) { /* non-critical */ }

        // Find user's roster & opponent
        const userRoster = rosters.find(r => r.owner_id === userId);
        if (!userRoster) return res.status(404).json({ error: 'Roster not found' });

        const userMatchup = matchups.find(m => m.roster_id === userRoster.roster_id);
        let opponentRoster = null;
        if (userMatchup?.matchup_id != null) {
            const oppMatch = matchups.find(m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRoster.roster_id);
            if (oppMatch) opponentRoster = rosters.find(r => r.roster_id === oppMatch.roster_id);
        }

        // Free agents sorted by this week's projection, then dynasty value
        const rosteredIds = new Set();
        rosters.forEach(r => (r.players || []).forEach(pid => rosteredIds.add(pid)));

        const freeAgents = Object.keys(nflPlayers)
            .filter(pid => {
                const p = nflPlayers[pid];
                return !rosteredIds.has(pid) && p.active &&
                    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position) && p.team;
            })
            .sort((a, b) => {
                // Sort by this week's projection first, then dynasty value
                const projA = weekProjections?.[a]?.[pprField] ?? weekProjections?.[a]?.pts_ppr ?? 0;
                const projB = weekProjections?.[b]?.[pprField] ?? weekProjections?.[b]?.pts_ppr ?? 0;
                if (projB !== projA) return projB - projA;
                return (marketValues[b] || 0) - (marketValues[a] || 0);
            });

        // Build prompt
        const prompt = buildPrompt({
            league, userRoster, opponentRoster,
            players: nflPlayers, users, rosters,
            freeAgents, matchups, transactions,
            week, marketValues, currentStats, prevStats,
            weekProjections, allMatchupHistory, pprField
        }, analysisType);

        // Stream from Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContentStream(prompt);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Remaining', String(rateCheck.remaining));

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Analyze team error:', error);
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: 'Analysis failed. Please try again.' });
        }
    }
}
