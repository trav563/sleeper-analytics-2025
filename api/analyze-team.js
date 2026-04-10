import { GoogleGenerativeAI } from '@google/generative-ai';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

// Simple in-memory rate limiting (per serverless instance)
const rateLimitMap = new Map();
const RATE_LIMIT_PER_DAY = 10;
const RATE_LIMIT_PER_HOUR = 3;

function checkRateLimit(userId) {
    const now = Date.now();
    const key = `rate:${userId}`;
    let entry = rateLimitMap.get(key);
    if (!entry) {
        entry = { hourly: [], daily: [] };
        rateLimitMap.set(key, entry);
    }
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    entry.hourly = entry.hourly.filter(t => t > oneHourAgo);
    entry.daily = entry.daily.filter(t => t > oneDayAgo);
    if (entry.daily.length >= RATE_LIMIT_PER_DAY) {
        return { allowed: false, reason: 'Daily limit reached (10/day). Try again tomorrow.', remaining: 0 };
    }
    if (entry.hourly.length >= RATE_LIMIT_PER_HOUR) {
        return { allowed: false, reason: 'Hourly limit reached (3/hour). Try again shortly.', remaining: RATE_LIMIT_PER_DAY - entry.daily.length };
    }
    entry.hourly.push(now);
    entry.daily.push(now);
    return { allowed: true, remaining: RATE_LIMIT_PER_DAY - entry.daily.length };
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} from ${url}`);
    return res.json();
}

// ── Helpers ──

function getScoringFormat(settings) {
    const recPts = settings?.rec ?? 0;
    if (recPts >= 1) return 'Full PPR (1.0 points per reception)';
    if (recPts >= 0.5) return 'Half PPR (0.5 points per reception)';
    return 'Standard (0 points per reception)';
}

function describeScoringSettings(settings) {
    if (!settings) return '';
    const lines = [];
    if (settings.pass_yd) lines.push(`Passing: ${settings.pass_yd} pts/yard, ${settings.pass_td || 4} pts/TD, ${settings.pass_int || -1} pts/INT`);
    if (settings.rush_yd) lines.push(`Rushing: ${settings.rush_yd} pts/yard, ${settings.rush_td || 6} pts/TD`);
    if (settings.rec_yd) lines.push(`Receiving: ${settings.rec_yd} pts/yard, ${settings.rec_td || 6} pts/TD, ${settings.rec || 0} pts/reception`);
    if (settings.bonus_rec_te) lines.push(`TE Premium: +${settings.bonus_rec_te} pts/reception for TEs`);
    if (settings.fum_lost) lines.push(`Fumble Lost: ${settings.fum_lost} pts`);
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
        })
        .join(', ');
}

function playerName(p) {
    if (!p) return 'Unknown';
    return `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function playerDetail(pid, players, marketValues, seasonStats) {
    const p = players[pid];
    if (!p) return null;
    const name = playerName(p);
    const pos = p.position || '?';
    const team = p.team || 'FA';
    const age = p.age || '?';
    const injury = p.injury_status || 'Healthy';
    const value = marketValues[pid] || 0;
    const depthOrder = p.depth_chart_order || '?';
    const nflStarter = depthOrder === 1 ? 'Starter' : depthOrder === 2 ? 'Backup' : depthOrder === 3 ? '3rd String' : '';

    // Last season stats
    const stats = seasonStats?.[pid];
    let statsStr = 'No stats';
    if (stats) {
        const gp = stats.gp || 0;
        const pts = stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std ?? 0;
        const ppg = gp > 0 ? (pts / gp).toFixed(1) : '0.0';
        statsStr = `${pts.toFixed(0)} pts in ${gp} games (${ppg} PPG)`;
    }

    return { pid, name, pos, team, age, injury, value, nflStarter, statsStr };
}

function buildPrompt(data, analysisType) {
    const {
        league, userRoster, opponentRoster, players, users, rosters,
        freeAgents, matchups, transactions, week, marketValues,
        seasonStats, allMatchupHistory
    } = data;

    const settings = league.settings || {};
    const scoringFormat = getScoringFormat(settings);
    const rosterSlotDesc = describeRosterSlots(league.roster_positions);
    const scoringDetail = describeScoringSettings(settings);
    const isSuperflex = (league.roster_positions || []).includes('SUPER_FLEX');
    const numTeams = settings.num_teams || rosters.length;
    const rosterPositions = league.roster_positions || [];

    // Count starting slots by type
    const slotCounts = {};
    rosterPositions.forEach(pos => {
        if (pos !== 'BN' && pos !== 'IR') {
            slotCounts[pos] = (slotCounts[pos] || 0) + 1;
        }
    });
    const startingSlotsDesc = Object.entries(slotCounts)
        .map(([pos, count]) => `${count}x ${pos}`)
        .join(', ');

    // ── User team info ──
    const userOwner = users.find(u => u.user_id === userRoster.owner_id);
    const teamName = userOwner?.metadata?.team_name || userOwner?.display_name || userOwner?.username || 'My Team';
    const wins = userRoster.settings?.wins || 0;
    const losses = userRoster.settings?.losses || 0;
    const ties = userRoster.settings?.ties || 0;
    const record = `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
    const fpts = (userRoster.settings?.fpts || 0) + ((userRoster.settings?.fpts_decimal || 0) / 100);
    const gamesPlayed = wins + losses + ties;
    const ppg = gamesPlayed > 0 ? (fpts / gamesPlayed).toFixed(1) : 'N/A (preseason)';

    // ── League standings ──
    const standings = [...rosters].sort((a, b) => {
        const aw = a.settings?.wins || 0, bw = b.settings?.wins || 0;
        if (aw !== bw) return bw - aw;
        const af = (a.settings?.fpts || 0) + ((a.settings?.fpts_decimal || 0) / 100);
        const bf = (b.settings?.fpts || 0) + ((b.settings?.fpts_decimal || 0) / 100);
        return bf - af;
    });
    const myRank = standings.findIndex(r => r.roster_id === userRoster.roster_id) + 1;

    const standingsText = standings.map((r, i) => {
        const owner = users.find(u => u.user_id === r.owner_id);
        const name = owner?.metadata?.team_name || owner?.display_name || owner?.username || `Team ${r.roster_id}`;
        const w = r.settings?.wins || 0;
        const l = r.settings?.losses || 0;
        const pts = ((r.settings?.fpts || 0) + ((r.settings?.fpts_decimal || 0) / 100)).toFixed(1);
        const isMe = r.roster_id === userRoster.roster_id ? ' ← YOUR TEAM' : '';
        return `${i + 1}. ${name} (${w}-${l}, ${pts} PF)${isMe}`;
    }).join('\n');

    // ── My roster with lineup slot mapping ──
    const starterIds = userRoster.starters || [];
    const allPlayerIds = userRoster.players || [];
    const benchIds = allPlayerIds.filter(pid => !starterIds.includes(pid));

    // Map starters to their lineup slots
    const starterLines = [];
    rosterPositions.forEach((slot, idx) => {
        if (slot === 'BN' || slot === 'IR') return;
        const pid = starterIds[idx];
        if (!pid || pid === '0') {
            starterLines.push(`| ${slot} | EMPTY SLOT | - | - | - | - | - |`);
            return;
        }
        const detail = playerDetail(pid, players, marketValues, seasonStats);
        if (!detail) return;
        starterLines.push(`| ${slot} | ${detail.name} | ${detail.pos} | ${detail.team} | ${detail.age} | ${detail.injury} | ${detail.nflStarter} | ${detail.statsStr} | ${detail.value} |`);
    });

    const benchLines = benchIds.map(pid => {
        const detail = playerDetail(pid, players, marketValues, seasonStats);
        if (!detail) return null;
        return `| BN | ${detail.name} | ${detail.pos} | ${detail.team} | ${detail.age} | ${detail.injury} | ${detail.nflStarter} | ${detail.statsStr} | ${detail.value} |`;
    }).filter(Boolean);

    // ── Opponent info ──
    let opponentSection = 'No opponent data available for this week.';
    if (opponentRoster) {
        const oppOwner = users.find(u => u.user_id === opponentRoster.owner_id);
        const oppName = oppOwner?.metadata?.team_name || oppOwner?.display_name || oppOwner?.username || 'Opponent';
        const oppW = opponentRoster.settings?.wins || 0;
        const oppL = opponentRoster.settings?.losses || 0;
        const oppPts = ((opponentRoster.settings?.fpts || 0) + ((opponentRoster.settings?.fpts_decimal || 0) / 100)).toFixed(1);

        const oppStarterLines = [];
        rosterPositions.forEach((slot, idx) => {
            if (slot === 'BN' || slot === 'IR') return;
            const pid = (opponentRoster.starters || [])[idx];
            if (!pid || pid === '0') {
                oppStarterLines.push(`| ${slot} | EMPTY | - | - |`);
                return;
            }
            const detail = playerDetail(pid, players, marketValues, seasonStats);
            if (!detail) return;
            oppStarterLines.push(`| ${slot} | ${detail.name} | ${detail.pos} | ${detail.statsStr} | ${detail.injury} |`);
        });

        opponentSection = `OPPONENT THIS WEEK: ${oppName} (Record: ${oppW}-${oppL}, ${oppPts} PF)
| Slot | Player | Pos | Last Season Stats | Injury |
|------|--------|-----|-------------------|--------|
${oppStarterLines.join('\n')}`;
    }

    // ── All league rosters (condensed) ──
    const leagueRostersText = rosters.map(r => {
        if (r.roster_id === userRoster.roster_id) return null; // Skip user's own
        const owner = users.find(u => u.user_id === r.owner_id);
        const name = owner?.metadata?.team_name || owner?.display_name || owner?.username || `Team ${r.roster_id}`;
        const w = r.settings?.wins || 0;
        const l = r.settings?.losses || 0;

        // Show key players (starters only, top by value)
        const keyPlayers = (r.starters || [])
            .filter(pid => pid && pid !== '0')
            .map(pid => {
                const p = players[pid];
                if (!p) return null;
                return `${p.position}:${playerName(p)}`;
            })
            .filter(Boolean)
            .join(', ');

        return `${name} (${w}-${l}): ${keyPlayers}`;
    }).filter(Boolean).join('\n');

    // ── Free agents (top 25 with stats) ──
    const topFA = freeAgents.slice(0, 25).map(pid => {
        const detail = playerDetail(pid, players, marketValues, seasonStats);
        if (!detail) return null;
        return `| ${detail.pos} | ${detail.name} | ${detail.team} | ${detail.nflStarter} | ${detail.statsStr} | ${detail.value} |`;
    }).filter(Boolean);

    // ── Recent transactions ──
    const recentTx = (transactions || []).slice(0, 20).map(tx => {
        const rosterOwner = users.find(u => {
            const r = rosters.find(r2 => tx.roster_ids?.includes(r2.roster_id) && r2.owner_id === u.user_id);
            return !!r;
        });
        const txName = rosterOwner?.display_name || 'Unknown';

        if (tx.type === 'trade') {
            const details = (tx.roster_ids || []).map(rid => {
                const r = rosters.find(r2 => r2.roster_id === rid);
                const owner = users.find(u => u.user_id === r?.owner_id);
                const tName = owner?.display_name || 'Unknown';
                const got = Object.entries(tx.adds || {}).filter(([, v]) => v === rid).map(([pid]) => {
                    const p = players[pid];
                    return p ? playerName(p) : pid;
                });
                return got.length > 0 ? `${tName} gets ${got.join(', ')}` : null;
            }).filter(Boolean);
            return `- TRADE: ${details.join(' | ')}`;
        }

        const adds = tx.adds ? Object.keys(tx.adds).map(pid => {
            const p = players[pid];
            return p ? `+${playerName(p)}` : `+${pid}`;
        }).join(', ') : '';
        const drops = tx.drops ? Object.keys(tx.drops).map(pid => {
            const p = players[pid];
            return p ? `-${playerName(p)}` : `-${pid}`;
        }).join(', ') : '';
        return `- ${tx.type}: ${txName} | ${adds} ${drops}`.trim();
    });

    // ── Matchup history (PPG by week) ──
    let matchupHistoryText = '';
    if (allMatchupHistory && Object.keys(allMatchupHistory).length > 0) {
        const weekScores = Object.entries(allMatchupHistory)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([w, matchups]) => {
                const myMatch = matchups.find(m => m.roster_id === userRoster.roster_id);
                if (!myMatch) return null;
                const opp = matchups.find(m => m.matchup_id === myMatch.matchup_id && m.roster_id !== myMatch.roster_id);
                const oppRoster = opp ? rosters.find(r => r.roster_id === opp.roster_id) : null;
                const oppOwner = oppRoster ? users.find(u => u.user_id === oppRoster.owner_id) : null;
                const oppName = oppOwner ? (oppOwner.display_name || oppOwner.username) : '?';
                const result = myMatch.points > (opp?.points || 0) ? 'W' : myMatch.points < (opp?.points || 0) ? 'L' : 'T';
                return `Week ${w}: ${myMatch.points?.toFixed(1) || 0} vs ${oppName} (${opp?.points?.toFixed(1) || 0}) → ${result}`;
            })
            .filter(Boolean);
        if (weekScores.length > 0) {
            matchupHistoryText = `\nMY GAME LOG THIS SEASON:\n${weekScores.join('\n')}`;
        }
    }

    // ── Analysis type instructions ──
    const typeInstructions = {
        full: `Provide a comprehensive analysis with these sections:
## Roster Grade
Give a letter grade (A+ to F) for each position group and overall. Base grades on player talent, depth, and the league's scoring format.
## This Week: Start/Sit
Recommend the OPTIMAL LINEUP for this week. You MUST fill every starting slot listed above. Account for FLEX and SUPER_FLEX slots — any eligible player can fill them. Don't tell me to sit a good player when they could go in a FLEX spot.
## Waiver Wire Targets
From the FREE AGENTS list above, identify 3-5 players worth adding. These are players NOT on any team in the league. Suggest who to drop.
## Trade Opportunities
Suggest 2-3 realistic trades with OTHER TEAMS IN THIS LEAGUE. Name the specific team and their players. ONLY suggest buying players that are on OTHER teams, never players already on MY team.
## Outlook
Brief playoff/season outlook based on remaining schedule and roster strength.`,

        startsit: `Focus ONLY on filling my starting lineup optimally for this week.
## Optimal Lineup
You MUST assign a player to EVERY starting slot (${startingSlotsDesc}). Use the roster slot types above.
- FLEX slots can be filled by RB, WR, or TE
- SUPER_FLEX slots can be filled by QB, RB, WR, or TE
- Don't leave good players on the bench when FLEX/SUPER_FLEX spots are available
- Consider matchups, recent performance, and injury status
- Show the full recommended lineup in a clear format

## Key Decisions
Explain the close calls and reasoning for any non-obvious choices.`,

        waivers: `Focus ONLY on waiver wire/free agent recommendations.
## Waiver Wire Targets
The FREE AGENTS listed above are the ONLY players available — they are not owned by any team in this league.
For each recommendation:
- Player name and position
- Their stats and why they're worth adding
- Who to DROP from my roster to make room (pick my weakest player)
- Priority ranking (must-add vs speculative)
Provide 5-7 recommendations.`,

        trades: `Focus ONLY on trade opportunities with other teams in this league.
## Trade Opportunities
IMPORTANT: All players on MY TEAM are listed in my roster above. Do NOT suggest I "buy" any player I already own.
Look at the OTHER TEAMS' ROSTERS listed below and suggest:
- 2-3 specific trade proposals (My Player X + Y → Their Player Z)
- Name the specific team I should trade with
- Explain why both sides benefit
- Consider dynasty values, age, and roster needs
- Factor in the trade deadline (Week ${settings.trade_deadline || 11})`,

        playoff: `Focus ONLY on playoff path analysis.
## Playoff Path
- Current standing: #${myRank} of ${numTeams} (${record})
- Playoffs: Top ${settings.playoff_teams || 6} teams, starting Week ${settings.playoff_week_start || 15}
- Analyze what record I need to make playoffs
- Identify key matchups remaining
- Strategic advice: compete now or build for future?`
    };

    const instructions = typeInstructions[analysisType] || typeInstructions.full;

    return `You are an expert fantasy football analyst providing advice for a specific team in a Sleeper dynasty/keeper league. You have access to the full league context below.

CRITICAL RULES:
1. Every player listed under "MY ROSTER" is ON MY TEAM. Do NOT suggest I acquire or "buy low" on any of them.
2. The "LINEUP SLOT" column shows which roster slot each player occupies (QB, RB, WR, TE, FLEX, SUPER_FLEX, K, DEF, BN=bench). Use these slots when making start/sit recommendations.
3. FLEX slots can be filled by RB/WR/TE. SUPER_FLEX can be filled by QB/RB/WR/TE. Always consider using FLEX for good players who don't fit a position slot.
4. "NFL Role" tells you if the player is a Starter, Backup, or 3rd String on their real NFL team. Heavily weight this — backups and 3rd stringers are risky.
5. "Last Season Stats" shows actual fantasy production. Use this data, not guesses.
6. "Dynasty Value" is from FantasyCalc (0-10,000 scale). Higher = more valuable.
7. FREE AGENTS listed are the only unowned players. Players on other teams must be acquired via trade.
8. Be specific and reference actual stats. Do not make up information.

═══════════════════════════════════════
LEAGUE SETTINGS
═══════════════════════════════════════
League: ${league.name || 'Unknown'}
Format: ${scoringFormat}
${scoringDetail}
Starting Lineup Slots: ${startingSlotsDesc}
Full Roster: ${rosterSlotDesc}
Teams: ${numTeams}
Playoffs: Top ${settings.playoff_teams || 6} teams, starting Week ${settings.playoff_week_start || 15}
Trade Deadline: Week ${settings.trade_deadline || 11}
Current Week: ${week}
${isSuperflex ? '⚠ This is a SUPERFLEX league — QBs are extra valuable.' : ''}

═══════════════════════════════════════
LEAGUE STANDINGS
═══════════════════════════════════════
${standingsText}

═══════════════════════════════════════
MY TEAM: ${teamName} (Record: ${record}, Rank: #${myRank}, PPG: ${ppg})
═══════════════════════════════════════

MY ROSTER (STARTERS):
| Lineup Slot | Player | Pos | NFL Team | Age | Injury | NFL Role | Last Season Stats | Dynasty Value |
|-------------|--------|-----|----------|-----|--------|----------|-------------------|---------------|
${starterLines.join('\n')}

MY ROSTER (BENCH):
| Slot | Player | Pos | NFL Team | Age | Injury | NFL Role | Last Season Stats | Dynasty Value |
|------|--------|-----|----------|-----|--------|----------|-------------------|---------------|
${benchLines.join('\n')}
${matchupHistoryText}

═══════════════════════════════════════
${opponentSection}
═══════════════════════════════════════

═══════════════════════════════════════
OTHER TEAMS IN THE LEAGUE (key starters):
═══════════════════════════════════════
${leagueRostersText}

═══════════════════════════════════════
FREE AGENTS (not on any team — available to add):
═══════════════════════════════════════
| Pos | Player | NFL Team | NFL Role | Last Season Stats | Dynasty Value |
|-----|--------|----------|----------|-------------------|---------------|
${topFA.join('\n')}

═══════════════════════════════════════
RECENT LEAGUE TRANSACTIONS:
═══════════════════════════════════════
${recentTx.length > 0 ? recentTx.join('\n') : 'No recent transactions.'}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
${instructions}`;
}

// ── Handler ──

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'AI service not configured' });
    }

    const { leagueId, userId, week, analysisType = 'full' } = req.body;
    if (!leagueId || !userId || !week) {
        return res.status(400).json({ error: 'Missing required fields: leagueId, userId, week' });
    }

    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.reason, remaining: rateCheck.remaining });
    }

    try {
        // Fetch all data in parallel
        const [league, rosters, users, matchups, nflPlayers] = await Promise.all([
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/rosters`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/users`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${week}`),
            fetchJSON(`${SLEEPER_BASE}/players/nfl`),
        ]);

        // Fetch last season stats + transactions + previous weeks matchups in parallel
        const season = league.season || '2025';
        const prevSeason = String(Number(season) - 1);

        const additionalFetches = [
            // Previous season stats for player evaluation
            fetchJSON(`${SLEEPER_BASE}/stats/nfl/regular/${prevSeason}`).catch(() => ({})),
            // Current + previous week transactions
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week}`).catch(() => []),
            week > 1 ? fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week - 1}`).catch(() => []) : Promise.resolve([]),
        ];

        // Fetch all past weeks of matchups for game log
        for (let w = 1; w < week; w++) {
            additionalFetches.push(
                fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${w}`).catch(() => null)
            );
        }

        const [seasonStats, txCurrent, txPrev, ...pastMatchups] = await Promise.all(additionalFetches);

        const transactions = [...(txCurrent || []), ...(txPrev || [])];

        // Build matchup history
        const allMatchupHistory = {};
        pastMatchups.forEach((m, idx) => {
            if (m) allMatchupHistory[idx + 1] = m;
        });

        // Fetch market values
        const settings = league.settings || {};
        const isSuperflex = (league.roster_positions || []).includes('SUPER_FLEX');
        const ppr = settings.rec ?? 0.5;
        const numTeams = settings.num_teams || rosters.length;
        let marketValues = {};
        try {
            const numQbs = isSuperflex ? 2 : 1;
            const mvRes = await fetch(`${FANTASY_CALC_API}?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`);
            if (mvRes.ok) {
                const mvData = await mvRes.json();
                mvData.forEach(p => { if (p.sleeperId) marketValues[p.sleeperId] = p.value; });
            }
        } catch (e) { /* non-critical */ }

        // Find user's roster
        const userRoster = rosters.find(r => r.owner_id === userId);
        if (!userRoster) {
            return res.status(404).json({ error: 'Roster not found for this user in the league' });
        }

        // Find opponent
        const userMatchup = matchups.find(m => m.roster_id === userRoster.roster_id);
        let opponentRoster = null;
        if (userMatchup?.matchup_id != null) {
            const oppMatchup = matchups.find(m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRoster.roster_id);
            if (oppMatchup) {
                opponentRoster = rosters.find(r => r.roster_id === oppMatchup.roster_id);
            }
        }

        // Determine free agents
        const rosteredPlayerIds = new Set();
        rosters.forEach(r => (r.players || []).forEach(pid => rosteredPlayerIds.add(pid)));

        const freeAgents = Object.keys(nflPlayers)
            .filter(pid => {
                const p = nflPlayers[pid];
                return !rosteredPlayerIds.has(pid) &&
                    p.active &&
                    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position) &&
                    p.team;
            })
            .sort((a, b) => (marketValues[b] || 0) - (marketValues[a] || 0));

        // Build prompt
        const prompt = buildPrompt({
            league, userRoster, opponentRoster,
            players: nflPlayers, users, rosters,
            freeAgents, matchups, transactions,
            week, marketValues, seasonStats,
            allMatchupHistory
        }, analysisType);

        // Call Gemini with streaming
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContentStream(prompt);

        // SSE streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Remaining', String(rateCheck.remaining));

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
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
