import { GoogleGenerativeAI } from '@google/generative-ai';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

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

// ── In-memory cache for shared data (stats, players, projections) ──
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

function getScoringFormat(scoringSettings) {
    const recPts = scoringSettings?.rec ?? 0;
    if (recPts >= 1) return 'Full PPR (1.0 pts/rec)';
    if (recPts >= 0.5) return 'Half PPR (0.5 pts/rec)';
    return 'Standard (0 pts/rec)';
}

function describeScoringSettings(scoringSettings) {
    if (!scoringSettings) return '';
    const lines = [];
    if (scoringSettings.pass_yd) lines.push(`Passing: ${scoringSettings.pass_yd} pts/yd, ${scoringSettings.pass_td || 4} pts/TD, ${scoringSettings.pass_int || -1} pts/INT`);
    if (scoringSettings.rush_yd) lines.push(`Rushing: ${scoringSettings.rush_yd} pts/yd, ${scoringSettings.rush_td || 6} pts/TD`);
    if (scoringSettings.rec_yd) lines.push(`Receiving: ${scoringSettings.rec_yd} pts/yd, ${scoringSettings.rec_td || 6} pts/TD, ${scoringSettings.rec || 0} pts/rec`);
    if (scoringSettings.bonus_rec_te) lines.push(`TE Premium: +${scoringSettings.bonus_rec_te} pts/rec for TEs`);
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

function hasActualScoring(stats) {
    if (!stats) return false;
    const sample = Object.values(stats).slice(0, 50);
    return sample.some(s => (s.pts_ppr > 0 || s.pts_half_ppr > 0 || s.gp > 0));
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
    return { pts, gp, ppg: (pts / gp).toFixed(1) };
}

function playerLine(pid, players, primaryStats, secondaryStats, weekProjections, pprField, primaryYear, secondaryYear) {
    const p = players[pid];
    if (!p) return null;
    const name = pName(p);
    const pos = p.position || '?';
    const team = p.team || 'FA';
    const age = p.age || '?';
    const injury = p.injury_status || 'Healthy';

    const pri = getStatsPPG(primaryStats?.[pid], pprField);
    let priStr = `No ${primaryYear} stats`;
    if (pri) priStr = `${primaryYear}: ${pri.pts.toFixed(0)} pts, ${pri.gp} GP, ${pri.ppg} PPG`;

    const sec = getStatsPPG(secondaryStats?.[pid], pprField);
    let secStr = '';
    if (sec) secStr = `${secondaryYear}: ${sec.pts.toFixed(0)} pts, ${sec.gp} GP, ${sec.ppg} PPG`;

    const proj = weekProjections?.[pid];
    let projStr = '';
    if (proj) {
        const projPts = proj[pprField] ?? proj.pts_ppr ?? 0;
        if (projPts > 0) projStr = `Proj: ${projPts.toFixed(1)}`;
    }

    const statsLine = [priStr, secStr, projStr].filter(Boolean).join(' | ');
    return { pid, name, pos, team, age, injury, statsLine };
}

// ── Prompt Builder ──

function buildPrompt(data, analysisType) {
    const {
        league, userRoster, opponentRoster, players, users, rosters,
        freeAgents, matchups, transactions, week,
        currentStats, prevStats, weekProjections, allMatchupHistory, pprField,
        playerNews
    } = data;

    const settings = league.settings || {};
    const scoringSettings = league.scoring_settings || {};
    const scoringFormat = getScoringFormat(scoringSettings);
    const rosterSlotDesc = describeRosterSlots(league.roster_positions);
    const scoringDetail = describeScoringSettings(scoringSettings);
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

    const leagueSeason = league.season || '2025';
    const leaguePrevSeason = String(Number(leagueSeason) - 1);
    const currentHasScoring = hasActualScoring(currentStats);
    const [primaryStats, secondaryStats, primaryYear, secondaryYear] = currentHasScoring
        ? [currentStats, prevStats, leagueSeason, leaguePrevSeason]
        : [prevStats, currentStats, leaguePrevSeason, leagueSeason];

    const makeRow = (pid) => playerLine(pid, players, primaryStats, secondaryStats, weekProjections, pprField, primaryYear, secondaryYear);

    const starterLines = [];
    rosterPositions.forEach((slot, idx) => {
        if (slot === 'BN' || slot === 'IR') return;
        const pid = starterIds[idx];
        if (!pid || pid === '0') { starterLines.push(`| ${slot} | EMPTY SLOT | - | - | - | - |`); return; }
        const d = makeRow(pid);
        if (!d) return;
        starterLines.push(`| ${slot} | ${d.name} | ${d.pos} | ${d.team} | ${d.age} | ${d.injury} | ${d.statsLine} |`);
    });

    const benchLines = benchIds.map(pid => {
        const d = makeRow(pid);
        if (!d) return null;
        return `| BN | ${d.name} | ${d.pos} | ${d.team} | ${d.age} | ${d.injury} | ${d.statsLine} |`;
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
            oppLines.push(`| ${slot} | ${d.name} | ${d.pos} | ${d.age} | ${d.statsLine} | ${d.injury} |`);
        });

        opponentSection = `OPPONENT THIS WEEK: ${oppName} (Record: ${oppW}-${oppL})
| Slot | Player | Pos | Age | Stats & Projection | Injury |
|------|--------|-----|-----|--------------------|--------|
${oppLines.join('\n')}`;
    }

    // ── Other teams (compact — for context on standings and opponent strength) ──
    const leagueRostersText = rosters.filter(r => r.roster_id !== userRoster.roster_id).map(r => {
        const o = users.find(u => u.user_id === r.owner_id);
        const name = o?.metadata?.team_name || o?.display_name || o?.username || `Team ${r.roster_id}`;
        const w = r.settings?.wins || 0, l = r.settings?.losses || 0;
        const keyPlayers = (r.starters || []).filter(pid => pid && pid !== '0').map(pid => {
            const p = players[pid];
            if (!p) return null;
            return `${p.position}:${pName(p)}`;
        }).filter(Boolean).join(', ');
        return `${name} (${w}-${l}): ${keyPlayers}`;
    }).join('\n');

    // ── Free agents ──
    const topFA = freeAgents.slice(0, 25).map(pid => {
        const d = makeRow(pid);
        if (!d) return null;
        return `| ${d.pos} | ${d.name} | ${d.team} | ${d.age} | ${d.statsLine} |`;
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

    // ── Player news ──
    const allRosterPids = [...(userRoster.players || [])];
    const rosterPlayerNames = allRosterPids.map(pid => {
        const p = players[pid];
        if (!p) return null;
        return `${p.first_name || ''} ${p.last_name || ''}`.trim().replace(/\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '');
    }).filter(Boolean);

    const matchedNews = (playerNews || []).filter(item => {
        if (!item?.title) return false;
        return rosterPlayerNames.some(name => name && item.title.toLowerCase().includes(name.toLowerCase()));
    }).slice(0, 10).map(item => {
        const daysAgo = item.pubDate ? Math.floor((Date.now() - new Date(item.pubDate).getTime()) / 86400000) : '?';
        return `- "${item.title}" (${daysAgo}d ago)`;
    });

    let playerNewsText = '';
    if (matchedNews.length > 0) {
        playerNewsText = `\nPLAYER NEWS (recent headlines about your roster players — use for context on injuries, role changes):\n${matchedNews.join('\n')}`;
    }

    // ── Instructions per analysis type ──
    const typeInstructions = {
        full: `You MUST use EXACTLY these sections and formats. Do not deviate. Do NOT use markdown tables. Use the bullet formats shown.

## Roster Grade
Use this EXACT bullet format, one bullet per position:
- **QB · [A+ to F]** — [Names] · [1 sentence using their stats/projections]
- **RB · [A+ to F]** — [Names] · [1 sentence]
- **WR · [A+ to F]** — [Names] · [1 sentence]
- **TE · [A+ to F]** — [Names] · [1 sentence]
- **K · [A+ to F]** — [Name] · [1 sentence]
- **DEF · [A+ to F]** — [Name] · [1 sentence]
- **Overall · [Grade]** — [1 sentence summary]

## This Week: Start/Sit
Use this EXACT bullet format for the optimal lineup, one bullet per starting slot:
- **[Slot]:** [Player] — [Proj Pts] proj · [1 sentence why]
(Fill EVERY starting slot: ${startingSlotsDesc}. FLEX=RB/WR/TE. SUPER_FLEX=QB/RB/WR/TE. Maximize projected points.)

**On the Bench:**
- [Player] (Pos) — [Brief reason they're sitting]
(List each bench player)

## Waiver Wire Targets
Players on my BENCH (listed above) are ALREADY ON MY ROSTER — never suggest adding them.
Use this EXACT numbered format for each target (3-5 targets from the FREE AGENTS list only):
1. **[Player Name]** ([Pos], [Team], Age [X]) — [Stats line] | Drop: [Player to drop] | [1 sentence why]
2. ...

## Outlook
${gp === 0 ? `This is PRESEASON — no games have been played yet. Use this format:
- **Roster assessment:** [Overall roster strength and readiness for the season]
- **Offseason priorities:** [1-2 moves to make before Week 1]
- **Ceiling/Floor:** [Best and worst case scenarios for this roster]` : `Use this EXACT bullet format:
- **Playoff picture:** [Current standing and what's needed]
- **Key weeks:** [Identify 2-3 critical upcoming matchups]
- **Strategy:** [1-2 sentences on compete now vs build for future]`}`,

        startsit: `You MUST use EXACTLY these sections and formats. Do NOT use markdown tables.

## Optimal Lineup
Use this EXACT bullet format, one bullet per starting slot:
- **[Slot]:** [Player] — [Proj Pts] proj · [1 sentence why]
(Fill EVERY slot: ${startingSlotsDesc}. FLEX=RB/WR/TE. SUPER_FLEX=QB/RB/WR/TE. Use projections as primary factor.)

**On the Bench:**
- [Player] (Pos) — [Why they're sitting]

## Key Decisions
Use bullet format for each close call:
- **[Player A] over [Player B] at [Slot]:** [Reasoning with projected points comparison]`,

        waivers: `You MUST use EXACTLY this format.
Players on my BENCH (listed above) are ALREADY ON MY ROSTER — never suggest adding them.

## Waiver Wire Targets
Use this EXACT numbered format (5-7 targets from the FREE AGENTS list ONLY):
1. **[Player Name]** ([Pos], [Team], Age [X]) — [Season/last season stats] | Drop: [Player] | Priority: [Must-Add / Strong Add / Speculative]
2. ...

## Summary
- [1-2 sentences on overall waiver strategy for this week]`,

        playoff: gp === 0 ? `You MUST use EXACTLY this format. This is PRESEASON — no games have been played yet. Do NOT use markdown tables.

## Season Preview
- **League Size:** ${numTeams} teams
- **Playoff Cutoff:** Top ${settings.playoff_teams || 6}
- **Playoffs Start:** Week ${settings.playoff_week_start || 15}

## Roster Readiness
- **Strengths:** [Position groups that are ready for Week 1]
- **Weaknesses:** [Position groups that need improvement before the season]
- **Key question marks:** [Players whose roles or health are uncertain]

## Offseason Action Plan
- **Move 1:** [Specific action to take]
- **Move 2:** [Another specific action]
- **Ceiling:** [Best case scenario for this roster]` :

        `You MUST use EXACTLY this format. Do NOT use markdown tables.

## Playoff Path
- **Current Rank:** #${myRank} of ${numTeams}
- **Record:** ${record}
- **Playoff Cutoff:** Top ${settings.playoff_teams || 6}
- **Playoffs Start:** Week ${settings.playoff_week_start || 15}
- **Projected Record Needed:** [Your estimate]

## Key Matchups
Use bullet format:
- **Week [X] vs [Team]:** [Why this matters — their record, strength]
(List 3-4 most important remaining games)

## Strategy
- **Window:** [Competing now or building for future? Why?]
- **Moves to make:** [1-2 specific actionable recommendations]`
    };

    const instructions = typeInstructions[analysisType] || typeInstructions.full;

    return `You are an expert fantasy football analyst. You have REAL DATA below — stats and projections from this season. Use this data to make your analysis. Do NOT rely on prior assumptions about player quality — use the stats and projections provided.

CRITICAL RULES:
1. Players under "MY ROSTER" are ON MY TEAM. Do not suggest I acquire players I already own.
2. Use the "Proj" column (weekly projection points) as the primary factor for start/sit decisions. If no projections are available, use PPG from the most recent season.
3. The "Lineup Slot" column shows the current slot assignment. FLEX=RB/WR/TE eligible. SUPER_FLEX=QB/RB/WR/TE eligible.
4. FREE AGENTS are unowned players available to add. Players on other teams require trades (use the Trade Finder tool for that).
5. Reference specific stats and projections in your analysis. No guessing.
6. Read the PLAYER NEWS section for context on injuries, role changes, and team moves.
7. A player with few games played (GP) was likely injured or suspended — judge them by PPG, not total points.

PLAYER EVALUATION GUIDE — use PPG from the stats columns to judge player quality:
- QB: Elite ≥ 18 PPG | Good ≥ 14 | Average ≥ 10
- RB: Elite ≥ 15 PPG | Good ≥ 11 | Average ≥ 7
- WR: Elite ≥ 15 PPG | Good ≥ 11 | Average ≥ 7
- TE: Elite ≥ 12 PPG | Good ≥ 8 | Average ≥ 5
- If a player has high PPG, they are a strong asset — grade them accordingly.
- If a player missed games, their PPG still reflects their talent level when healthy.

═══════════════════════════════════════
LEAGUE SETTINGS
═══════════════════════════════════════
League: ${league.name || 'Unknown'}
Format: ${scoringFormat}
${scoringDetail}
Starting Slots: ${startingSlotsDesc}
Full Roster: ${rosterSlotDesc}
Teams: ${numTeams} | Playoffs: Top ${settings.playoff_teams || 6}, Week ${settings.playoff_week_start || 15}
Current Week: ${week}
${isSuperflex ? '⚠ SUPERFLEX league — QBs are extra valuable.' : ''}

═══════════════════════════════════════
STANDINGS
═══════════════════════════════════════
${standingsText}

═══════════════════════════════════════
MY TEAM: ${teamName} (${record}, #${myRank}, ${ppg} PPG)
═══════════════════════════════════════

STARTERS:
| Slot | Player | Pos | Team | Age | Injury | Stats & Projection |
|------|--------|-----|------|-----|--------|---------------------|
${starterLines.join('\n')}

BENCH:
| Slot | Player | Pos | Team | Age | Injury | Stats & Projection |
|------|--------|-----|------|-----|--------|---------------------|
${benchLines.join('\n')}
${matchupHistoryText}
${playerNewsText}

═══════════════════════════════════════
${opponentSection}
═══════════════════════════════════════

OTHER TEAMS IN LEAGUE:
${leagueRostersText}

═══════════════════════════════════════
FREE AGENTS (unowned, available to add):
| Pos | Player | Team | Age | Stats & Projection |
|-----|--------|------|-----|---------------------|
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
        const league = await fetchJSON(`${SLEEPER_BASE}/league/${leagueId}`);
        const settings = league.settings || {};
        const scoringSettings = league.scoring_settings || {};
        const recPts = scoringSettings.rec ?? 0;
        const pprField = recPts >= 1 ? 'pts_ppr' : recPts >= 0.5 ? 'pts_half_ppr' : 'pts_std';
        const leagueSeason = league.season || '2025';
        const leaguePrevSeason = String(Number(leagueSeason) - 1);

        // Fetch all data in parallel
        const [rosters, users, matchups, nflPlayers, currentStats, prevStats, weekProjections] = await Promise.all([
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/rosters`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/users`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${week}`),
            fetchCached('players', `${SLEEPER_BASE}/players/nfl`),
            fetchCached(`stats-${leagueSeason}`, `${SLEEPER_BASE}/stats/nfl/regular/${leagueSeason}`).catch(() => ({})),
            fetchCached(`stats-${leaguePrevSeason}`, `${SLEEPER_BASE}/stats/nfl/regular/${leaguePrevSeason}`).catch(() => ({})),
            fetchCached(`proj-${leagueSeason}-${week}`, `${SLEEPER_BASE}/projections/nfl/regular/${leagueSeason}/${week}`).catch(() => ({})),
        ]);

        // Transactions
        let transactions = [];
        try {
            const [txCur, txPrev] = await Promise.all([
                fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week}`).catch(() => []),
                week > 1 ? fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week - 1}`).catch(() => []) : Promise.resolve([]),
            ]);
            transactions = [...(txCur || []), ...(txPrev || [])];
        } catch (e) { /* non-critical */ }

        // Past matchups for game log
        const allMatchupHistory = {};
        if (week > 1) {
            const pastPromises = [];
            for (let w = 1; w < week; w++) {
                pastPromises.push(fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${w}`).catch(() => null));
            }
            const pastMatchups = await Promise.all(pastPromises);
            pastMatchups.forEach((m, idx) => { if (m) allMatchupHistory[idx + 1] = m; });
        }

        // Player news (RSS)
        let playerNews = [];
        try {
            const Parser = (await import('rss-parser')).default;
            const parser = new Parser();
            const cached = dataCache.get('rss-news');
            let newsItems;
            if (cached && Date.now() - cached.time < CACHE_TTL) {
                newsItems = cached.data;
            } else {
                const feed = await parser.parseURL('https://fftoday.com/rss/news.xml');
                newsItems = (feed.items || []).map(item => ({ title: item.title, pubDate: item.pubDate }));
                dataCache.set('rss-news', { data: newsItems, time: Date.now() });
            }
            playerNews = newsItems || [];
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

        // Free agents sorted by projection, then by primary stats PPG
        const rosteredIds = new Set();
        rosters.forEach(r => (r.players || []).forEach(pid => rosteredIds.add(pid)));

        const freeAgents = Object.keys(nflPlayers)
            .filter(pid => {
                const p = nflPlayers[pid];
                return !rosteredIds.has(pid) && p.active &&
                    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position) && p.team;
            })
            .sort((a, b) => {
                const projA = weekProjections?.[a]?.[pprField] ?? weekProjections?.[a]?.pts_ppr ?? 0;
                const projB = weekProjections?.[b]?.[pprField] ?? weekProjections?.[b]?.pts_ppr ?? 0;
                if (projB !== projA) return projB - projA;
                // Fallback: sort by primary stats PPG
                const currentHasScoring = hasActualScoring(currentStats);
                const primary = currentHasScoring ? currentStats : prevStats;
                const ppgA = primary?.[a]?.gp ? ((primary[a][pprField] || 0) / primary[a].gp) : 0;
                const ppgB = primary?.[b]?.gp ? ((primary[b][pprField] || 0) / primary[b].gp) : 0;
                return ppgB - ppgA;
            });

        // Build prompt
        const prompt = buildPrompt({
            league, userRoster, opponentRoster,
            players: nflPlayers, users, rosters,
            freeAgents, matchups, transactions, week,
            currentStats, prevStats,
            weekProjections, allMatchupHistory, pprField,
            playerNews
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
