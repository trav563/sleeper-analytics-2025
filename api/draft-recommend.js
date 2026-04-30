import { streamText } from 'ai';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FANTASY_CALC = 'https://api.fantasycalc.com/values/current';

// ── Rate limits (per serverless instance) ──
const rateLimitMap = new Map();
const RATE_PER_MINUTE = 1;
const RATE_PER_DRAFT = 30;

function checkRateLimit(userId, draftId) {
    const now = Date.now();
    const key = `${userId}:${draftId}`;
    let entry = rateLimitMap.get(key);
    if (!entry) { entry = { recent: [], total: 0 }; rateLimitMap.set(key, entry); }
    entry.recent = entry.recent.filter((t) => t > now - 60_000);
    if (entry.total >= RATE_PER_DRAFT) return { allowed: false, reason: 'Per-draft AI limit reached (30 calls).' };
    if (entry.recent.length >= RATE_PER_MINUTE) return { allowed: false, reason: 'Slow down — 1 AI call per minute.' };
    entry.recent.push(now);
    entry.total += 1;
    return { allowed: true };
}

// ── Cache for canonical state and shared lookups ──
const dataCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;
const SHORT_TTL = 30 * 1000;

async function fetchCached(key, url, ttl = CACHE_TTL) {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.time < ttl) return cached.data;
    const data = await fetchJSON(url);
    dataCache.set(key, { data, time: Date.now() });
    return data;
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} from ${url}`);
    return res.json();
}

// ── Recommendation cache: same (draft, pick, user) returns cached text ──
const recCache = new Map();
const REC_TTL = 30 * 60 * 1000;

function pName(p) {
    if (!p) return 'Unknown';
    return `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function buildPrompt(data) {
    const {
        draft, league, players,
        myRosterIds, myPickNo, myUpcomingPicks, recentPicks,
        topAvailable, draftType,
    } = data;

    const numTeams = draft.settings?.teams || draft.settings?.num_teams || 12;
    const totalRounds = draft.settings?.rounds || 0;
    const recPts = league.scoring_settings?.rec ?? 0;
    const ppr = recPts >= 1 ? 'Full PPR' : recPts >= 0.5 ? 'Half PPR' : 'Standard';
    const isSuperflex = (league.roster_positions || []).includes('SUPER_FLEX');
    const rosterSlots = (league.roster_positions || []).filter((s) => s !== 'BN' && s !== 'IR').join(', ');

    const myPlayersText = myRosterIds.length
        ? myRosterIds.map((pid) => {
            const p = players[pid];
            if (!p) return pid;
            return `${pName(p)} (${p.position}, ${p.team || 'FA'}, age ${p.age ?? '?'})`;
        }).join('; ')
        : '(empty roster — startup or first pick)';

    const availableText = topAvailable.map((pl, idx) => {
        const inj = pl.injury ? ` [${pl.injury}]` : '';
        const exp = pl.yearsExp === 0 ? ', rookie' : pl.yearsExp != null ? `, ${pl.yearsExp}y exp` : '';
        return `${idx + 1}. ${pl.name} (${pl.pos}, ${pl.team}, age ${pl.age ?? '?'}${exp})${inj} — value ${pl.value || '?'}`;
    }).join('\n');

    const recentText = (recentPicks || []).slice(-10).map((p) => {
        const pl = players[p.player_id];
        return `#${p.pick_no} ${pName(pl) || p.metadata?.first_name + ' ' + p.metadata?.last_name} (${pl?.position || p.metadata?.position})`;
    }).join('  ·  ') || 'No picks yet.';

    const upcomingText = myUpcomingPicks.length
        ? myUpcomingPicks.slice(0, 4).map((pn) => `#${pn}`).join(', ')
        : 'No further picks';

    const draftTypeContext = {
        rookie: 'This is a ROOKIE/KEEPER draft — only first-year NFL players are available. Weight prospect pedigree (NFL draft capital), landing spot, opportunity.',
        startup: 'This is a STARTUP draft for a new dynasty league — long-term value matters most. Younger players age 21-25 with breakout potential are worth more than older established stars.',
        annual_redraft: 'This is an ANNUAL REDRAFT — only this season\'s production matters. Ignore age/dynasty value, focus on weekly start-ability and ceiling.',
    }[draftType] || '';

    return `You are an expert fantasy football draft assistant helping a user pick from a live draft. Be decisive and concise.

LEAGUE: ${league.name || 'Unknown'} · ${ppr} · ${numTeams} teams · ${totalRounds} rounds
SCORING: ${ppr}${isSuperflex ? ' · SUPERFLEX (QBs more valuable)' : ''}
STARTING SLOTS: ${rosterSlots}
DRAFT TYPE: ${draftTypeContext}

CURRENT PICK: #${myPickNo} (Round ${Math.ceil(myPickNo / numTeams)})
MY UPCOMING PICKS: ${upcomingText}

MY CURRENT ROSTER:
${myPlayersText}

LAST PICKS:
${recentText}

TOP 25 AVAILABLE (sorted by FantasyCalc dynasty value):
${availableText}

INSTRUCTIONS:
Pick the 3 best players for me to draft RIGHT NOW. For each, give 1-2 sentences of reasoning that references value, fit, scarcity, and how they shape my roster going forward.

OUTPUT FORMAT (use this exactly — no preamble, no closing):

## 🎯 Top Pick
**[Player Name]** ([Pos], [Team]) — [reasoning, 1-2 sentences]

## 2nd Choice
**[Player Name]** ([Pos], [Team]) — [reasoning, 1-2 sentences]

## 3rd Choice
**[Player Name]** ([Pos], [Team]) — [reasoning, 1-2 sentences]

## Quick Take
[1 sentence overall strategy for the rest of this draft based on current state]`;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey && !process.env.VERCEL) {
        return res.status(500).json({ error: 'AI service not configured (set AI_GATEWAY_API_KEY)' });
    }

    const { draftId, leagueId, userId, pickNo, draftType } = req.body || {};
    if (!draftId || !leagueId || !userId || !pickNo) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Result cache by (draft, pick, user) — covers reload spam
    const cacheKey = `${draftId}:${pickNo}:${userId}`;
    const cached = recCache.get(cacheKey);
    if (cached && Date.now() - cached.time < REC_TTL) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Cached', '1');
        // Replay cached text as a single SSE chunk
        res.write(`data: ${JSON.stringify({ text: cached.text })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
    }

    const rate = checkRateLimit(userId, draftId);
    if (!rate.allowed) return res.status(429).json({ error: rate.reason });

    try {
        const [draft, league, picks, players] = await Promise.all([
            fetchCached(`draft-${draftId}-${pickNo}`, `${SLEEPER_BASE}/draft/${draftId}`, SHORT_TTL),
            fetchCached(`league-${leagueId}`, `${SLEEPER_BASE}/league/${leagueId}`),
            fetchCached(`picks-${draftId}-${pickNo}`, `${SLEEPER_BASE}/draft/${draftId}/picks`, SHORT_TTL),
            fetchCached('players', `${SLEEPER_BASE}/players/nfl`),
        ]);

        const rosters = await fetchCached(`rosters-${leagueId}`, `${SLEEPER_BASE}/league/${leagueId}/rosters`, SHORT_TTL);

        // FantasyCalc values
        const isSuperflex = (league.roster_positions || []).includes('SUPER_FLEX');
        const numTeams = league.settings?.num_teams || 12;
        const recPts = league.scoring_settings?.rec ?? 0.5;
        const fcUrl = `${FANTASY_CALC}?isDynasty=true&numQbs=${isSuperflex ? 2 : 1}&numTeams=${numTeams}&ppr=${recPts}`;
        let marketValues = {};
        try {
            const fc = await fetchCached(`fc-${isSuperflex}-${numTeams}-${recPts}`, fcUrl, 4 * 60 * 60 * 1000);
            (fc || []).forEach((p) => { if (p.sleeperId) marketValues[p.sleeperId] = p.value; });
        } catch { /* fall back to no values */ }

        // Resolve user's roster + picks
        const userRoster = rosters.find((r) => r.owner_id === userId);
        const userSlot = (draft.draft_order || {})[userId];
        const myDraftedIds = (picks || [])
            .filter((p) => p.draft_slot === userSlot)
            .map((p) => p.player_id)
            .filter(Boolean);
        // For rookie/annual: include kept roster too
        const myRosterIds = draftType === 'rookie' || draftType === 'annual_redraft'
            ? [...new Set([...(userRoster?.players || []), ...myDraftedIds])]
            : myDraftedIds;

        // Best-available pool
        const draftedSet = new Set((picks || []).map((p) => p.player_id).filter(Boolean));
        if (draftType === 'rookie' || draftType === 'annual_redraft') {
            rosters.forEach((r) => (r.players || []).forEach((pid) => draftedSet.add(pid)));
        }

        const fantasyPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
        const candidates = [];
        for (const pid of Object.keys(players)) {
            if (draftedSet.has(pid)) continue;
            const p = players[pid];
            if (!p || !fantasyPositions.has(p.position)) continue;
            if (!p.active && p.position !== 'DEF') continue;
            if (draftType === 'rookie' && (p.years_exp ?? null) !== 0) continue;
            candidates.push({
                id: pid,
                name: pName(p),
                pos: p.position,
                team: p.team || 'FA',
                age: p.age ?? null,
                yearsExp: p.years_exp ?? null,
                injury: p.injury_status || null,
                value: marketValues[pid] || 0,
            });
        }
        candidates.sort((a, b) => b.value - a.value);
        const topAvailable = candidates.slice(0, 25);

        // Compute upcoming picks for the user
        const totalRounds = draft.settings?.rounds || 0;
        const totalTeams = draft.settings?.teams || draft.settings?.num_teams || 12;
        const myUpcomingPicks = [];
        if (userSlot) {
            const startRound = Math.ceil(pickNo / totalTeams);
            for (let r = startRound; r <= totalRounds; r++) {
                const slotInRound = r % 2 === 0 ? totalTeams - userSlot + 1 : userSlot;
                const pn = (r - 1) * totalTeams + slotInRound;
                if (pn >= pickNo) myUpcomingPicks.push(pn);
            }
        }

        const prompt = buildPrompt({
            draft, league, players,
            myRosterIds, myPickNo: pickNo, myUpcomingPicks,
            recentPicks: picks, topAvailable, draftType,
        });

        const result = streamText({
            model: 'google/gemini-2.0-flash',
            prompt,
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullText = '';
        for await (const text of result.textStream) {
            if (text) {
                fullText += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }
        // Cache the full result for this (draft, pick, user)
        recCache.set(cacheKey, { text: fullText, time: Date.now() });
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    } catch (err) {
        console.error('Draft recommend error:', err);
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: 'Recommendation failed. Try again.' });
        }
    }
}
