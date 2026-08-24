# League Analysis

Analytics for [Sleeper](https://sleeper.com) fantasy football leagues, built for **dynasty** play. Enter a Sleeper username, pick a league, and get matchup breakdowns, power rankings, dynasty asset values, trade analysis, and multi-season history — including past seasons, which Sleeper stores as separate leagues chained by `previous_league_id`.

Live at **[leagueanalysis.app](https://leagueanalysis.app)**.

There is no account, no password, and no server-side database. Everything comes from Sleeper's public API, and the only thing kept in your browser is your Sleeper profile plus cached results.

## Features

- **Dashboard** — matchup hero, standings, roster news, injury report, playoff odds
- **My Team** — lineup optimizer, roster construction, asset ledger, season outlook
- **Analytics** — power rankings, positional strength, defense-faced ranks, season trends
- **History** — full dynasty chain across seasons, draft ROI, records, superlatives
- **Tools** — trade simulator (age-aware for dynasty), rookie draft board, trade retro, dynasty window, schedule generator, lineup checker
- **AI coach** — optional written analysis of your team (see [Privacy](#privacy))

## Tech stack

Vite 7 · React 19 · JavaScript (`.jsx`) · React Router 6 · Tailwind 3.4 · TanStack Query 5 · Recharts · Framer Motion · Vitest 4. Deployed on Vercel with two serverless functions in `api/`.

No TypeScript, no Next.js, no pnpm.

## Getting started

Requires Node 20.19+ or 22.12+.

```bash
npm install
```

```bash
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm test` | Vitest suite |
| `npm run lint` | ESLint |
| `npm run update-byes` | Regenerate `src/data/byeWeeks.json` + `nflOpponents.json` from nflverse |

The client needs no environment variables. The AI endpoint needs server-side ones (below), and the rest of the app works without them.

## Project structure

Feature-first: each feature owns its components and hooks.

```
api/                        Vercel serverless functions (analyze-team, news)
handoff/                    Design system: tokens.css, components.md, page-briefs/
scripts/                    Data generation (bye weeks, opponents)
src/
├── components/ui/          Shared primitives (Pip, StatCell, SectionCard, TabBar, …)
├── components/layout/      Navbar
├── context/                SleeperContext, ThemeContext
├── data/                   Generated JSON (bye weeks, NFL opponents)
├── features/<feature>/     components/ + hooks/ per feature
│                           analytics, dashboard, history, league,
│                           recap, stats, team, tools, user
├── layouts/                Route layouts
├── pages/                  Route components
├── services/               sleeperEngine (league-chain walking)
├── utils/                  sleeper API client, scoring, seasonState, localData, …
├── App.jsx                 Routes
└── main.jsx                Entry point + error boundary
```

## Data sources

| Source | Used for |
| --- | --- |
| [Sleeper API](https://docs.sleeper.com) | Leagues, rosters, users, matchups, players, projections, drafts, transactions |
| [FantasyCalc](https://fantasycalc.com) | Dynasty trade values for players and picks |
| DynastyProcess | Fallback dynasty values |
| [nflverse](https://github.com/nflverse) | Schedule / bye weeks (build-time, via `npm run update-byes`) |
| ESPN | Weather and game context |
| FFToday RSS | News headlines (proxied through `api/news`) |
| Vercel AI Gateway | AI team analysis — `google/gemini-3-flash`, falling back to `anthropic/claude-haiku-4.5` |

Sleeper stores each dynasty season as its own league. `src/services/sleeperEngine.js` walks `previous_league_id` backwards to assemble the full chain so history spans every season the league has played.

## Privacy

- Data is read from Sleeper's **public** API. Nothing about your league is stored on a server.
- `localStorage` holds your Sleeper profile, cached playoff odds, cached AI analyses (expired after 7 days), and your saved schedule generator state. **Sign out** clears all of it.
- The only server-side state is a 24-hour rate-limit counter keyed on IP address.
- **When you request an AI analysis**, the league's name and settings, every manager's display name and record, your full roster, your opponents' starting lineups, your game log, and recent transactions are sent to Google (fallback: Anthropic) through the Vercel AI Gateway. This is the one place league data leaves Sleeper and this app.
- Page views are counted with Vercel Web Analytics, with league/team/player IDs stripped from the URL before the beacon is sent (`redactAnalyticsUrl` in `src/App.jsx`).

## Environment variables

Server-side only — never exposed to the client. Set them in Vercel, not in a committed file.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | for AI | Vercel AI Gateway auth (`VERCEL_OIDC_TOKEN` works on Vercel) |
| `KV_REST_API_URL` | for AI | Redis REST endpoint — durable rate limiting |
| `KV_REST_API_TOKEN` | for AI | Redis REST token, **write access** |

The Redis pair is whatever your provisioning method injects: Vercel's Upstash
marketplace integration sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`, while a
hand-configured Upstash database uses `UPSTASH_REDIS_REST_URL` / `_TOKEN`. Either
is accepted. Do **not** point it at `KV_REST_API_READ_ONLY_TOKEN` — the limiter
issues `INCR`/`EXPIRE`, and a read-only token makes every request fail closed,
which is indistinguishable from an outage.

The AI endpoint **fails closed**: without Upstash configured it returns 503 rather than falling back to a per-instance limiter that gets weaker as Vercel scales out.

## Design system

The UI follows a **"Broadcast Scoreboard"** direction — dark-mode first, tabular numerals, team-color pips, gold signal accent, red-orange reserved for LIVE states. Tokens live in `handoff/tokens.css`, component recipes in `handoff/components.md`, per-page targets in `handoff/page-briefs/`. See `CLAUDE.md` for the conventions that apply when editing.

## License

MIT
