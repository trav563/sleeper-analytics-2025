import { streamText } from 'ai';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

// String model IDs route through Vercel AI Gateway when AI_GATEWAY_API_KEY
// is set (or VERCEL_OIDC_TOKEN on Vercel). Single key, pooled rate limits,
// observability, billed via Vercel.
const PRIMARY_MODEL = 'google/gemini-2.0-flash';
const FALLBACK_MODEL = 'anthropic/claude-haiku-4.5';

// ── Rate Limiting (in-memory, per serverless instance) ──
const rateLimitMap = new Map();
const RATE_LIMIT_PER_DAY = 30;
const RATE_LIMIT_PER_HOUR = 10;

function checkRateLimit(userId) {
    const now = Date.now();
    const key = `rate:${userId}`;
    let entry = rateLimitMap.get(key);
    if (!entry) { entry = { hourly: [], daily: [] }; rateLimitMap.set(key, entry); }
    entry.hourly = entry.hourly.filter(t => t > now - 3600000);
    entry.daily = entry.daily.filter(t => t > now - 86400000);
    if (entry.daily.length >= RATE_LIMIT_PER_DAY)
        return { allowed: false, reason: `Daily limit reached (${RATE_LIMIT_PER_DAY}/day). Try again tomorrow.`, remaining: 0 };
    if (entry.hourly.length >= RATE_LIMIT_PER_HOUR)
        return { allowed: false, reason: `Hourly limit reached (${RATE_LIMIT_PER_HOUR}/hour). Try again shortly.`, remaining: RATE_LIMIT_PER_DAY - entry.daily.length };
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

// Server-side mirror of getRookieLockState in src/utils/sleeper.js. Kept inline
// because there's no shared module between client and server.
function getRookieLockState(league, drafts) {
    const out = { rookiesLocked: false, nextDraftStartTime: null };
    if (!league || !Array.isArray(drafts)) return out;
    const type = league.settings?.type;
    if (type !== 1 && type !== 2) return out;
    const season = String(league.season || '');
    const pending = drafts.filter(
        (d) => String(d?.season || '') === season &&
            (d?.status === 'pre_draft' || d?.status === 'drafting')
    );
    if (pending.length === 0) return out;
    out.rookiesLocked = true;
    const soonest = pending.map((d) => Number(d?.start_time) || 0)
        .filter((t) => t > 0).sort((a, b) => a - b)[0];
    out.nextDraftStartTime = soonest || null;
    return out;
}

function getStatsPPG(stats, pprField) {
    if (!stats) return null;
    const gp = stats.gp || 0;
    const pts = stats[pprField] ?? stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std ?? 0;
    if (gp === 0) return null;
    return { pts, gp, ppg: (pts / gp).toFixed(1) };
}

// ── Quick-wins data (weather, opponent matchups) ──

const ESPN_SCOREBOARD = (week) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}`;

const INDOOR_TEAMS = new Set(['ATL', 'NO', 'DET', 'MIN', 'IND', 'HOU', 'DAL', 'LAR', 'LV', 'ARI', 'LAC']);

function normAbbr(a) { return a === 'WSH' ? 'WAS' : a; }

/**
 * Returns { [teamAbbr]: { opponent, isHome, weather: { temp, condition, isAdverse } } }
 * for the given NFL week. Cached for 30 min in-memory.
 */
async function fetchWeekContext(week) {
    const cacheKey = `espn-context-${week}`;
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;
    const out = {};
    try {
        const data = await fetchJSON(ESPN_SCOREBOARD(week));
        (data.events || []).forEach((event) => {
            const competition = event.competitions?.[0];
            if (!competition) return;
            const competitors = competition.competitors || [];
            const weather = event.weather;

            competitors.forEach((c) => {
                const abbr = normAbbr(c.team?.abbreviation);
                if (!abbr) return;
                const oppC = competitors.find((o) => o !== c);
                const oppAbbr = oppC ? normAbbr(oppC.team?.abbreviation) : null;
                const isHome = c.homeAway === 'home';

                let weatherBlock = null;
                if (weather && !INDOOR_TEAMS.has(abbr)) {
                    const temp = weather.temperature ? parseInt(weather.temperature) : null;
                    const condition = weather.displayValue || '';
                    const lower = condition.toLowerCase();
                    const isAdverse = (temp !== null && temp < 35)
                        || lower.includes('rain') || lower.includes('snow')
                        || lower.includes('storm') || lower.includes('wind');
                    weatherBlock = { temp, condition, isAdverse };
                }
                out[abbr] = { opponent: oppAbbr, isHome, weather: weatherBlock };
            });
        });
    } catch {
        // ignore — fall through to empty map
    }
    dataCache.set(cacheKey, { data: out, time: Date.now() });
    return out;
}

function snapPctLine(stats) {
    if (!stats) return null;
    const snaps = stats.off_snp || stats.def_snp || 0;
    const teamSnaps = stats.tm_off_snp || stats.tm_def_snp || 0;
    if (!snaps || !teamSnaps) return null;
    const pct = Math.round((snaps / teamSnaps) * 100);
    return `${pct}% snap rate`;
}

function playerContextLine(pid, players, weekContext, currentStats) {
    const p = players[pid];
    if (!p) return '';
    const team = p.team;
    const ctx = team ? weekContext[team] : null;
    const parts = [];
    if (ctx?.opponent) parts.push(`vs ${ctx.opponent}${ctx.isHome ? ' (home)' : ' (away)'}`);
    if (ctx?.weather?.isAdverse) {
        const w = ctx.weather;
        const bits = [];
        if (w.temp !== null) bits.push(`${w.temp}°F`);
        if (w.condition) bits.push(w.condition);
        parts.push(`weather: ${bits.join(', ')} (adverse)`);
    }
    const snap = snapPctLine(currentStats?.[pid]);
    if (snap) parts.push(snap);
    return parts.length ? ` [${parts.join(' · ')}]` : '';
}

function playerLine(pid, players, primaryStats, secondaryStats, weekProjections, pprField, primaryYear, secondaryYear, weekContext) {
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
    const ctxLine = weekContext ? playerContextLine(pid, players, weekContext, primaryStats) : '';
    return { pid, name, pos, team, age, injury, statsLine: statsLine + ctxLine };
}

// ── Prompt Builder ──

function buildPrompt(data, analysisType, constraint) {
    const {
        league, userRoster, opponentRoster, players, users, rosters,
        freeAgents, matchups, transactions, week,
        currentStats, prevStats, weekProjections, allMatchupHistory, pprField,
        playerNews, weekContext, lockState
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

    const makeRow = (pid) => playerLine(pid, players, primaryStats, secondaryStats, weekProjections, pprField, primaryYear, secondaryYear, weekContext);

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
        lineup: `You MUST use EXACTLY these sections and formats. Do NOT use markdown tables.

## Optimal Lineup
Use this EXACT bullet format, one bullet per starting slot:
- **[Slot]:** [Player] — [Proj Pts] proj · [1 sentence why, referencing their opponent/snap rate/weather if relevant]
(Fill EVERY slot: ${startingSlotsDesc}. FLEX=RB/WR/TE. SUPER_FLEX=QB/RB/WR/TE. Maximize projected points.)

**On the Bench:**
- [Player] (Pos) — [Why they're sitting]

## Key Decisions
List 2-3 close calls (where two players are within ~3 projected points). Bullet format:
- **[Player A] over [Player B] at [Slot]:** [Reasoning citing projection, matchup, or weather]`,

        roster: `You MUST use EXACTLY these sections and formats. Do NOT use markdown tables.

## Roster Grade
One bullet per position group:
- **QB · [A+ to F]** — [Names] · [1 sentence citing PPG, projection, or supporting cast]
- **RB · [A+ to F]** — [Names] · [1 sentence]
- **WR · [A+ to F]** — [Names] · [1 sentence]
- **TE · [A+ to F]** — [Names] · [1 sentence]
- **K · [A+ to F]** — [Name] · [1 sentence]
- **DEF · [A+ to F]** — [Name] · [1 sentence]
- **Overall · [Grade]** — [1 sentence summary tying it together]

## Strengths & Weaknesses
- **Strengths:** [1-2 sentences on what this roster does well]
- **Weaknesses:** [1-2 sentences on what's vulnerable]`,

        waivers: `You MUST use EXACTLY this format. Do NOT use markdown tables.
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

    // Default unknown analysisType to 'roster' (defensive — never 400-fail).
    const instructions = typeInstructions[analysisType] || typeInstructions.roster;

    // Constraint-specific extra instruction appended at the end.
    const constraintInstructions = {
        ceiling: 'CONSTRAINT: Prioritize CEILING over floor. Recommend the lineup with maximum upside even if variance is high.',
        floor: 'CONSTRAINT: Prioritize FLOOR over ceiling. Recommend the safest lineup — minimize variance, accept lower upside.',
        stack: 'CONSTRAINT: Recommend a lineup that STACKS at least one of my QB\'s pass-catchers (WR or TE on the same NFL team).',
        'trade-up': 'CONSTRAINT: Suggest 2-3 specific TRADE-UP packages where I send 2 depth players to upgrade one starting spot. Be concrete about which player on which team.',
        'sell-high': 'CONSTRAINT: Identify 2-3 players on MY ROSTER whose value is currently at a peak and who I should consider trading away while their stock is high.',
        'low-rostered': 'CONSTRAINT: Only recommend waiver targets with LOW expected rostered % (under 25% of leagues). Pure speculative ceiling adds, not consensus picks.',
        streamers: 'CONSTRAINT: Only recommend DEF and K waiver targets — strictly streaming options for this week\'s matchup.',
        compete: 'CONSTRAINT: Frame all advice assuming I am COMPETING for a championship THIS year. Recommend short-term moves only; do not suggest selling for picks.',
        build: 'CONSTRAINT: Frame all advice assuming I am REBUILDING for next year. Recommend long-term moves; trade veterans for picks/youth.',
    };
    const constraintTail = constraint && constraintInstructions[constraint]
        ? `\n\n${constraintInstructions[constraint]}`
        : '';

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
${lockState?.rookiesLocked ? 'IMPORTANT: This league has not yet held its rookie draft, so rookies are locked from waiver pickups. The free agents list below has been pre-filtered to exclude rookies. Do not suggest any rookie players as waiver targets.\n\n' : ''}FREE AGENTS (unowned, available to add):
| Pos | Player | Team | Age | Stats & Projection |
|-----|--------|------|-----|---------------------|
${topFA.join('\n')}

RECENT TRANSACTIONS:
${recentTx.length > 0 ? recentTx.join('\n') : 'None.'}

═══════════════════════════════════════
${instructions}${constraintTail}`;
}

// ── Handler ──

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Gateway-managed; either AI_GATEWAY_API_KEY (preferred) or auto-OIDC on Vercel.
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
        return res.status(500).json({ error: 'AI service not configured (set AI_GATEWAY_API_KEY in Vercel)' });
    }

    const { leagueId, userId, week, analysisType = 'roster', constraint = null } = req.body;
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

        // Fetch all data in parallel (Sleeper + ESPN week context for opponent/weather/snaps).
        const [rosters, users, matchups, nflPlayers, currentStats, prevStats, weekProjections, weekContext, drafts] = await Promise.all([
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/rosters`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/users`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${week}`),
            fetchCached('players', `${SLEEPER_BASE}/players/nfl`),
            fetchCached(`stats-${leagueSeason}`, `${SLEEPER_BASE}/stats/nfl/regular/${leagueSeason}`).catch(() => ({})),
            fetchCached(`stats-${leaguePrevSeason}`, `${SLEEPER_BASE}/stats/nfl/regular/${leaguePrevSeason}`).catch(() => ({})),
            fetchCached(`proj-${leagueSeason}-${week}`, `${SLEEPER_BASE}/projections/nfl/regular/${leagueSeason}/${week}`).catch(() => ({})),
            fetchWeekContext(week).catch(() => ({})),
            fetchCached(`drafts-${leagueId}`, `${SLEEPER_BASE}/league/${leagueId}/drafts`).catch(() => []),
        ]);

        // Lock rookies in dynasty/keeper leagues with a pending current-season draft.
        const lockState = getRookieLockState(league, drafts);

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
                if (!p || rosteredIds.has(pid) || !p.active) return false;
                if (!['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position)) return false;
                if (!p.team) return false;
                // Rookies aren't pickable until the league's rookie draft completes.
                if (lockState.rookiesLocked && (p.years_exp == null || p.years_exp === 0)) return false;
                return true;
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
            playerNews, weekContext, lockState
        }, analysisType, constraint);

        // Stream via Vercel AI Gateway. streamText() returns immediately;
        // provider errors fire during textStream iteration. We try the
        // primary first; if iteration throws BEFORE any chunk has been
        // written to the response (so headers haven't been flushed), we
        // restart with the fallback model. If the throw happens mid-stream,
        // we surface the error via SSE.
        const tryStream = async (modelId) => {
            const result = streamText({ model: modelId, prompt });
            // Buffer the first chunk so we can detect setup-time errors before
            // committing to streaming the response back to the client.
            const iterator = result.textStream[Symbol.asyncIterator]();
            const first = await iterator.next();
            return { iterator, first };
        };

        let stream;
        let usedFallback = false;
        try {
            stream = await tryStream(PRIMARY_MODEL);
        } catch (err) {
            const msg = err?.message || '';
            if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit|SAFETY|blocked|503|UNAVAILABLE/i.test(msg)) {
                console.warn(`[ai] primary ${PRIMARY_MODEL} failed (${msg.slice(0, 200)}); falling back to ${FALLBACK_MODEL}`);
                stream = await tryStream(FALLBACK_MODEL);
                usedFallback = true;
            } else {
                throw err;
            }
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Remaining', String(rateCheck.remaining));
        res.setHeader('X-Model', usedFallback ? FALLBACK_MODEL : PRIMARY_MODEL);

        // Flush the buffered first chunk, then drain the rest.
        if (!stream.first.done && stream.first.value) {
            res.write(`data: ${JSON.stringify({ text: stream.first.value })}\n\n`);
        }
        while (true) {
            const { done, value } = await stream.iterator.next();
            if (done) break;
            if (value) res.write(`data: ${JSON.stringify({ text: value })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Analyze team error:', error);
        const raw = error?.message || 'Analysis failed. Please try again.';
        // Translate common Gemini SDK errors into user-actionable messages.
        let userMessage = raw;
        if (/quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(raw)) {
            userMessage = 'AI service is busy (Gemini rate limit hit). Wait ~60 seconds and try again.';
        } else if (/SAFETY|blocked|safety_settings/i.test(raw)) {
            userMessage = 'Gemini blocked this analysis (safety filter). Try a different card or constraint.';
        } else if (/API key|API_KEY|UNAUTHENTICATED|PERMISSION_DENIED/i.test(raw)) {
            userMessage = 'AI service unauthenticated. Verify AI_GATEWAY_API_KEY in Vercel.';
        } else if (/timeout|ETIMEDOUT|ECONNRESET|503|UNAVAILABLE/i.test(raw)) {
            userMessage = 'Gemini service unavailable right now. Try again in a moment.';
        }
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: userMessage, raw })}\n\n`);
            res.end();
        } else {
            res.status(500).json({
                error: userMessage,
                raw,
                code: error?.status || error?.code || null
            });
        }
    }
}
