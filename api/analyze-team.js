import { GoogleGenerativeAI } from '@google/generative-ai';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

// Simple in-memory rate limiting (per serverless instance)
// For production scale, replace with Upstash Redis
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

    // Clean old entries
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

function getScoringFormat(settings) {
    const recPts = settings?.rec ?? 0;
    if (recPts >= 1) return 'PPR';
    if (recPts >= 0.5) return 'Half PPR';
    return 'Standard';
}

function getRosterSlots(positions) {
    if (!positions) return 'Unknown';
    const counts = {};
    positions.forEach(pos => {
        counts[pos] = (counts[pos] || 0) + 1;
    });
    return Object.entries(counts).map(([pos, count]) => count > 1 ? `${count}${pos}` : pos).join(', ');
}

function buildPrompt(data, analysisType) {
    const { league, userRoster, opponentRoster, players, users, rosters, freeAgents, matchups, transactions, week, marketValues } = data;

    const settings = league.settings || {};
    const scoringFormat = getScoringFormat(settings);
    const rosterSlots = getRosterSlots(league.roster_positions);
    const isSuperflex = (league.roster_positions || []).filter(p => p === 'SUPER_FLEX').length > 0;
    const numTeams = settings.num_teams || rosters.length;

    // Find user info
    const userOwner = users.find(u => u.user_id === userRoster.owner_id);
    const teamName = userOwner?.metadata?.team_name || userOwner?.display_name || userOwner?.username || 'My Team';
    const record = `${userRoster.settings?.wins || 0}-${userRoster.settings?.losses || 0}`;
    const fpts = (userRoster.settings?.fpts || 0) + ((userRoster.settings?.fpts_decimal || 0) / 100);
    const gamesPlayed = (userRoster.settings?.wins || 0) + (userRoster.settings?.losses || 0) + (userRoster.settings?.ties || 0);
    const ppg = gamesPlayed > 0 ? (fpts / gamesPlayed).toFixed(1) : '0.0';

    // Rank
    const sortedRosters = [...rosters].sort((a, b) => {
        const aw = a.settings?.wins || 0, bw = b.settings?.wins || 0;
        if (aw !== bw) return bw - aw;
        const af = (a.settings?.fpts || 0) + ((a.settings?.fpts_decimal || 0) / 100);
        const bf = (b.settings?.fpts || 0) + ((b.settings?.fpts_decimal || 0) / 100);
        return bf - af;
    });
    const rank = sortedRosters.findIndex(r => r.roster_id === userRoster.roster_id) + 1;

    // Build roster table
    function playerRow(pid) {
        const p = players[pid];
        if (!p) return null;
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
        const pos = p.position || '?';
        const team = p.team || 'FA';
        const injury = p.injury_status || '-';
        const value = marketValues[pid] || '-';
        return `| ${pos} | ${name} | ${team} | ${injury} | ${value} |`;
    }

    const starters = (userRoster.starters || []).map(playerRow).filter(Boolean);
    const bench = (userRoster.players || [])
        .filter(pid => !(userRoster.starters || []).includes(pid))
        .map(playerRow)
        .filter(Boolean);

    // Opponent info
    let opponentSection = '';
    if (opponentRoster) {
        const oppOwner = users.find(u => u.user_id === opponentRoster.owner_id);
        const oppName = oppOwner?.metadata?.team_name || oppOwner?.display_name || oppOwner?.username || 'Opponent';
        const oppRecord = `${opponentRoster.settings?.wins || 0}-${opponentRoster.settings?.losses || 0}`;
        const oppStarters = (opponentRoster.starters || []).map(playerRow).filter(Boolean);
        opponentSection = `
OPPONENT THIS WEEK: ${oppName} (${oppRecord})
| Pos | Player | Team | Injury | Value |
|-----|--------|------|--------|-------|
${oppStarters.join('\n')}`;
    }

    // Free agents (top 30 by market value)
    const topFA = freeAgents
        .slice(0, 30)
        .map(pid => {
            const p = players[pid];
            if (!p) return null;
            const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
            return `| ${p.position || '?'} | ${name} | ${p.team || 'FA'} | ${marketValues[pid] || 0} |`;
        })
        .filter(Boolean);

    // Recent transactions
    const recentTx = (transactions || []).slice(0, 15).map(tx => {
        const adds = tx.adds ? Object.keys(tx.adds).map(pid => {
            const p = players[pid];
            return p ? `+${p.first_name} ${p.last_name}` : `+${pid}`;
        }).join(', ') : '';
        const drops = tx.drops ? Object.keys(tx.drops).map(pid => {
            const p = players[pid];
            return p ? `-${p.first_name} ${p.last_name}` : `-${pid}`;
        }).join(', ') : '';
        const txUser = users.find(u => tx.roster_ids?.includes(rosters.find(r => r.owner_id === u.user_id)?.roster_id));
        const txName = txUser?.display_name || 'Unknown';
        return `- ${tx.type}: ${txName} | ${adds} ${drops}`.trim();
    });

    // Upcoming schedule (simplified - who they play next few weeks)
    const upcomingInfo = matchups ? `Current matchup data is for Week ${week}.` : '';

    // Analysis type instructions
    const typeInstructions = {
        full: `Provide a comprehensive analysis with these sections:
## Roster Grade
Give letter grades for each position group and overall.
## This Week: Start/Sit
Recommend optimal lineup decisions for this week with reasoning.
## Waiver Wire Targets
Identify 3-5 available players worth adding, prioritized.
## Trade Opportunities
Suggest 2-3 trade scenarios (sell-high, buy-low candidates).
## Outlook
Brief playoff/season outlook and strategic advice.`,

        startsit: `Focus ONLY on lineup decisions for this week. For each position:
## Start/Sit Recommendations
- Who to START and why (matchup, recent trends)
- Who to SIT and why
- Any FLEX decisions to consider
Be specific with matchup analysis and player usage trends.`,

        waivers: `Focus ONLY on waiver wire/free agent recommendations:
## Waiver Wire Targets
For each recommendation:
- Player name and position
- Why they're available and why they shouldn't be
- Who to drop from the roster to make room
- Priority ranking (must-add vs nice-to-have)
Provide 5-7 actionable recommendations.`,

        trades: `Focus ONLY on trade opportunities:
## Trade Opportunities
- Identify 2-3 players to SELL HIGH (overperforming or about to decline)
- Identify 2-3 players to BUY LOW (underperforming or about to break out)
- Suggest 2-3 specific trade packages with reasoning
- Consider the league's trade deadline and playoff schedule
Factor in dynasty/market values provided.`,

        playoff: `Focus ONLY on playoff path analysis:
## Playoff Path
- Current standing and what record is needed to make playoffs
- Remaining schedule difficulty assessment
- Key matchups that will determine playoff fate
- Strategic advice (play for now vs build for future)
- Tiebreaker scenarios to be aware of`
    };

    const instructions = typeInstructions[analysisType] || typeInstructions.full;

    return `You are an expert fantasy football analyst. Provide specific, actionable advice based on the data below. Reference actual player names. Be concise and direct. Use markdown formatting.

LEAGUE SETTINGS:
- Format: ${scoringFormat}${isSuperflex ? ' (Superflex)' : ''}
- Roster Slots: ${rosterSlots}
- Teams: ${numTeams}
- Playoffs: Week ${settings.playoff_week_start || 15}, Top ${settings.playoff_teams || 6}
- Current Week: ${week}
- Trade Deadline: Week ${settings.trade_deadline || 11}

MY TEAM: ${teamName} (Record: ${record}, Rank: #${rank}, PPG: ${ppg})

STARTERS:
| Pos | Player | Team | Injury | Dynasty Value |
|-----|--------|------|--------|---------------|
${starters.join('\n')}

BENCH:
| Pos | Player | Team | Injury | Dynasty Value |
|-----|--------|------|--------|---------------|
${bench.join('\n')}
${opponentSection}

TOP AVAILABLE FREE AGENTS (by dynasty value):
| Pos | Player | Team | Value |
|-----|--------|------|-------|
${topFA.join('\n')}

RECENT LEAGUE ACTIVITY:
${recentTx.length > 0 ? recentTx.join('\n') : 'No recent transactions.'}

${upcomingInfo}

${instructions}`;
}

export default async function handler(req, res) {
    // Only allow POST
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

    // Rate limit check
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.reason, remaining: rateCheck.remaining });
    }

    try {
        // Fetch all needed data from Sleeper API in parallel
        const [league, rosters, users, matchups, nflPlayers] = await Promise.all([
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/rosters`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/users`),
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/matchups/${week}`),
            fetchJSON(`${SLEEPER_BASE}/players/nfl`),
        ]);

        // Fetch recent transactions (current + previous week)
        let transactions = [];
        try {
            const [txCurrent, txPrev] = await Promise.all([
                fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week}`),
                week > 1 ? fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/transactions/${week - 1}`) : Promise.resolve([]),
            ]);
            transactions = [...(txCurrent || []), ...(txPrev || [])];
        } catch (e) {
            // Non-critical, continue without transactions
        }

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
        } catch (e) {
            // Non-critical
        }

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

        // Determine free agents (players not on any roster)
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
            week, marketValues
        }, analysisType);

        // Call Gemini with streaming
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContentStream(prompt);

        // Set up SSE streaming
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

        // If headers already sent (streaming started), end the stream with error
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: 'Analysis failed. Please try again.' });
        }
    }
}
