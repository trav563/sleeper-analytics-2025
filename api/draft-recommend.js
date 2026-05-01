import { streamText } from 'ai';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FANTASY_CALC = 'https://api.fantasycalc.com/values/current';

// Routes through Vercel AI Gateway (set AI_GATEWAY_API_KEY locally; Vercel
// deployments auto-auth via VERCEL_OIDC_TOKEN). Mirrors api/analyze-team.js.
const PRIMARY_MODEL = 'google/gemini-2.0-flash';
const FALLBACK_MODEL = 'anthropic/claude-haiku-4.5';

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

// Inlined copy of src/features/draft/utils/draftOwnership.js — Vercel
// serverless functions don't bundle src/, so duplicate the small helper here.
function buildOwnership({ draft, tradedPicks }) {
    const slotToRoster = draft?.slot_to_roster_id || {};
    const draftSeason = String(draft?.season || '');
    const trades = (tradedPicks || []).filter((t) => String(t?.season || '') === draftSeason);
    const overrides = {};
    for (const t of trades) {
        if (!overrides[t.round]) overrides[t.round] = {};
        overrides[t.round][t.roster_id] = t.owner_id;
    }
    const numTeams = Number(draft?.settings?.teams || draft?.settings?.num_teams || 0);
    const totalRounds = Number(draft?.settings?.rounds || 0);
    const isSnake = draft?.type !== 'linear';

    function originalOwnerForSlot(slot) { return slotToRoster[slot] ?? null; }
    function currentOwnerForSlotRound(slot, round) {
        const o = originalOwnerForSlot(slot);
        if (o == null) return null;
        return overrides[round]?.[o] ?? o;
    }
    function slotForPick(pickNo) {
        if (!pickNo || !numTeams) return null;
        const round = Math.ceil(pickNo / numTeams);
        const posInRound = ((pickNo - 1) % numTeams) + 1;
        return isSnake && round % 2 === 0 ? numTeams - posInRound + 1 : posInRound;
    }
    function currentOwnerForPickNo(pickNo) {
        const slot = slotForPick(pickNo);
        if (slot == null) return null;
        return currentOwnerForSlotRound(slot, Math.ceil(pickNo / numTeams));
    }
    function pickNosOwnedBy(rosterId, fromPickNo = 1) {
        const out = [];
        if (!rosterId || !numTeams || !totalRounds) return out;
        const total = numTeams * totalRounds;
        for (let pn = fromPickNo; pn <= total; pn++) {
            if (currentOwnerForPickNo(pn) === rosterId) out.push(pn);
        }
        return out;
    }
    return { originalOwnerForSlot, currentOwnerForSlotRound, currentOwnerForPickNo, pickNosOwnedBy, numTeams, totalRounds };
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
        // Surface BOTH FantasyCalc value and Sleeper rank so the AI never
        // sees a 0 with no context. Lower Sleeper rank = better.
        const valueStr = pl.value > 0
            ? `FC value ${pl.value}`
            : pl.searchRank != null && pl.searchRank < 9999
                ? `Sleeper rank #${pl.searchRank}`
                : 'no rank';
        return `${idx + 1}. ${pl.name} (${pl.pos}, ${pl.team}, age ${pl.age ?? '?'}${exp})${inj} — ${valueStr}`;
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

TOP 25 AVAILABLE (sorted best-to-worst — FantasyCalc dynasty value when present, else Sleeper consensus rank):
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

    const { draftId, leagueId, userId, pickNo, draftType, bustCache } = req.body || {};
    if (!draftId || !leagueId || !userId || !pickNo) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Result cache by (draft, pick, user) — covers reload spam.
    // bustCache = true skips the lookup so the user can force a fresh
    // recommendation via the Refresh button.
    const cacheKey = `${draftId}:${pickNo}:${userId}`;
    if (!bustCache) {
        const cached = recCache.get(cacheKey);
        if (cached && Date.now() - cached.time < REC_TTL) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Cached', '1');
            res.write(`data: ${JSON.stringify({ text: cached.text })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
        }
    } else {
        // Drop the existing entry so the new one replaces it cleanly.
        recCache.delete(cacheKey);
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
        const tradedPicks = await fetchCached(
            `tradedPicks-${leagueId}`,
            `${SLEEPER_BASE}/league/${leagueId}/traded_picks`,
            SHORT_TTL
        ).catch(() => []);

        // FantasyCalc values
        const isSuperflex = (league.roster_positions || []).includes('SUPER_FLEX');
        const numTeams = league.settings?.num_teams || 12;
        const recPts = league.scoring_settings?.rec ?? 0.5;
        const fcUrl = `${FANTASY_CALC}?isDynasty=true&numQbs=${isSuperflex ? 2 : 1}&numTeams=${numTeams}&ppr=${recPts}`;
        let marketValues = {};
        try {
            const fc = await fetchCached(`fc-${isSuperflex}-${numTeams}-${recPts}`, fcUrl, 4 * 60 * 60 * 1000);
            // sleeperId is nested under entry.player, not at the top level.
            // Same bug we fixed in src/utils/fantasyCalc.js.
            (fc || []).forEach((entry) => {
                const sleeperId = entry?.player?.sleeperId;
                if (sleeperId) marketValues[sleeperId] = entry.value;
            });
        } catch { /* fall back to no values */ }

        // Resolve user's roster + picks (using actual drafter, not slot, so
        // traded picks are attributed correctly).
        const userRoster = rosters.find((r) => r.owner_id === userId);
        const userRosterId = userRoster?.roster_id ?? null;
        const myDraftedIds = (picks || [])
            .filter((p) => p.roster_id === userRosterId)
            .map((p) => p.player_id)
            .filter(Boolean);
        // For rookie/annual: include kept roster too
        const myRosterIds = draftType === 'rookie' || draftType === 'annual_redraft'
            ? [...new Set([...(userRoster?.players || []), ...myDraftedIds])]
            : myDraftedIds;

        const ownership = buildOwnership({ draft, tradedPicks });

        // Best-available pool
        const draftedSet = new Set((picks || []).map((p) => p.player_id).filter(Boolean));
        if (draftType === 'rookie' || draftType === 'annual_redraft') {
            rosters.forEach((r) => (r.players || []).forEach((pid) => draftedSet.add(pid)));
        }

        // Rookie drafts skip K/DEF — those slots are filled via waivers.
        const fantasyPositions = new Set(
            draftType === 'rookie'
                ? ['QB', 'RB', 'WR', 'TE']
                : ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
        );
        const candidates = [];
        for (const pid of Object.keys(players)) {
            if (draftedSet.has(pid)) continue;
            const p = players[pid];
            if (!p || !fantasyPositions.has(p.position)) continue;
            // Must be on an NFL team and active (excludes "Did Not Sign" rookies).
            if (!p.team) continue;
            if (p.status && p.status !== 'Active') continue;
            if (!p.active && p.position !== 'DEF') continue;
            if (draftType === 'rookie' && (p.years_exp ?? null) !== 0) continue;
            const fcValue = marketValues[pid] || 0;
            const searchRank = p.search_rank ?? 9999;
            // Fallback: when FC has no value, use Sleeper's native ranking
            // converted to a comparable scale.
            const sortValue = fcValue > 0
                ? fcValue
                : Math.max(0, (10000 - Math.min(searchRank, 10000)) / 10);
            candidates.push({
                id: pid,
                name: pName(p),
                pos: p.position,
                team: p.team || 'FA',
                age: p.age ?? null,
                yearsExp: p.years_exp ?? null,
                injury: p.injury_status || null,
                value: fcValue,
                searchRank,
                sortValue,
            });
        }
        // Sort by FC value when present, search_rank otherwise. Ensures the
        // AI always sees a meaningfully-ordered top 25.
        candidates.sort((a, b) => b.sortValue - a.sortValue);
        const topAvailable = candidates.slice(0, 25);

        // Compute upcoming picks for the user (post-trade — uses ownership map).
        const myUpcomingPicks = ownership.pickNosOwnedBy(userRosterId, pickNo);

        const prompt = buildPrompt({
            draft, league, players,
            myRosterIds, myPickNo: pickNo, myUpcomingPicks,
            recentPicks: picks, topAvailable, draftType,
        });

        // Buffer the first chunk so we can fail over to the secondary model
        // before any bytes hit the client. Mirrors api/analyze-team.js.
        const tryStream = async (modelId) => {
            const result = streamText({ model: modelId, prompt });
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
        res.setHeader('X-Model', usedFallback ? FALLBACK_MODEL : PRIMARY_MODEL);

        let fullText = '';
        if (!stream.first.done && stream.first.value) {
            fullText += stream.first.value;
            res.write(`data: ${JSON.stringify({ text: stream.first.value })}\n\n`);
        }
        while (true) {
            const { done, value } = await stream.iterator.next();
            if (done) break;
            if (value) {
                fullText += value;
                res.write(`data: ${JSON.stringify({ text: value })}\n\n`);
            }
        }
        // Cache the full result for this (draft, pick, user)
        recCache.set(cacheKey, { text: fullText, time: Date.now() });
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    } catch (err) {
        console.error('Draft recommend error:', err);
        const raw = err?.message || 'Recommendation failed. Try again.';
        let userMessage = raw;
        if (/quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(raw)) {
            userMessage = 'AI service is busy. Wait ~60 seconds and try again.';
        } else if (/SAFETY|blocked|safety_settings/i.test(raw)) {
            userMessage = 'AI blocked this recommendation (safety filter).';
        } else if (/API key|API_KEY|UNAUTHENTICATED|PERMISSION_DENIED/i.test(raw)) {
            userMessage = 'AI service unauthenticated. Verify AI_GATEWAY_API_KEY in Vercel.';
        } else if (/timeout|ETIMEDOUT|ECONNRESET|503|UNAVAILABLE/i.test(raw)) {
            userMessage = 'AI service unavailable right now. Try again in a moment.';
        }
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: userMessage })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: userMessage });
        }
    }
}
