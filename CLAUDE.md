# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server (requires Node 20.19+ or 22.12+)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — ESLint over the repo (`src/reference/**` and `dist` are ignored)

There are no tests configured. Vercel serverless functions in `api/` are not exercised by `vite dev`; test them via `vercel dev` or by deploying to a preview.

## Architecture

### Runtime shape
React 19 SPA built with Vite, deployed to Vercel. The frontend is a pure client app (Vercel `vercel.json` rewrites everything to `index.html`); a small set of Vercel serverless functions in `api/` handle anything that needs a server (Gemini key, RSS scraping).

### Provider stack (set up in `src/main.jsx` and `src/App.jsx`)
`ErrorBoundary` → `QueryClientProvider` (TanStack Query) → `HelmetProvider` → `SleeperProvider` → `BrowserRouter`. All routes are lazy-loaded via `React.lazy` inside `App.jsx` with a shared `PageLoader` `Suspense` fallback.

### Routing & data flow
Two layouts under `/` (`MainLayout`) and `/league/:leagueId` (`LeagueLayout`). `LeagueLayout` is the data hub: it calls `useLeagueData(leagueId)` (React Query bundle) and `loadHistory(...)` from `SleeperContext`, then exposes everything to child pages (`DashboardPage`, `LineupPage`, `AnalyticsPage`, `HistoryPage`, `ToolsPage`, `RecapPage`) via `<Outlet context={{ league, rosters, users, players, user, state, currentWeek, matchups, transactions, tradedPicks, ... }} />`. Pages read this with `useOutletContext()` rather than re-fetching.

### State boundaries
- **`SleeperContext`** (`src/context/SleeperContext.jsx`) — owns the logged-in `user`, `leagues`, `season`, and recursive `leagueHistory`. The user is persisted to `localStorage` under `sleeper_user`; on mount it hydrates from there and fetches `/state/nfl` to set the current season.
- **TanStack Query** — owns all server data with explicit `staleTime`s (NFL state 1h, players 24h, league/users/rosters 1h, current-week matchups 60s). Don't bypass these caches; if you need a refetch, invalidate the query key.

### Sleeper API layer
`src/utils/sleeper.js` is the single boundary to `https://api.sleeper.app/v1`. **Every league-scoped fetch appends a `?_=Date.now()` cache-buster** to defeat Sleeper's edge caching — preserve this pattern when adding endpoints. `src/services/sleeperEngine.js` builds higher-level operations on top (recursive league history walking via `previous_league_id`).

### Feature directory convention
`src/features/<area>/{components,hooks,data,utils}` — `analytics`, `dashboard`, `history`, `league`, `recap`, `stats`, `tools`, `user`. Pages in `src/pages/` are thin shells that compose feature components. UI primitives are in `src/components/ui/` (Button, Card, Dialog, Tabs, etc.). Shared cross-feature helpers live in `src/utils/` (e.g. `sleeper.js`, `fantasyCalc.js`, `nflData.js`, `scoreProjections.js`).

### External data sources
- Sleeper API (`src/utils/sleeper.js`) — leagues, rosters, matchups, players, transactions, drafts, traded picks, stats, projections.
- FantasyCalc (`src/utils/fantasyCalc.js`) — dynasty market values, configured by `isSuperflex`/`numTeams`/`ppr`.
- FFToday RSS — proxied through `api/news.js` to avoid CORS and add a 10-minute Vercel edge cache.

### Serverless functions (`api/`)
- `api/news.js` — RSS proxy with `s-maxage=600` cache.
- `api/analyze-team.js` — POST endpoint that pulls full league context from Sleeper, builds a heavily structured prompt (one of `full`/`startsit`/`waivers`/`playoff`), and **streams** Gemini (`gemini-2.0-flash`) output back as SSE (`text/event-stream`). It enforces in-memory rate limits (3/hour, 10/day per `userId`) and a 30-minute in-memory cache for shared payloads (players, season stats, projections, RSS). Both are per-serverless-instance — they reset on cold start. Requires `GEMINI_API_KEY` env var.

### Notable conventions
- The `src/reference/` folder holds an external project kept around for reference and is excluded from ESLint — don't ship code from it.
- `no-unused-vars` is set to `warn` and ignores identifiers matching `^[A-Z_]` (intentional for unused capitalized imports/constants).
- Page transitions use `framer-motion`'s `AnimatePresence` keyed by `location.pathname` inside `LeagueLayout`.
