# Implementation Phases

Work top to bottom. Commit at each checkpoint. Don't skip.

---

## Phase 0 — Setup (no UI changes)

1. `git checkout -b ui-overhaul`
2. Copy `handoff/CLAUDE.md` to repo root.
3. Copy `handoff/tokens.css` into `app/globals.css` (either paste contents or `@import "../handoff/tokens.css"`).
4. Merge `handoff/tailwind.config.ts` `theme.extend` into your existing `tailwind.config.ts`.
5. Copy `handoff/theme.ts` to `lib/theme.ts`.
6. Swap in Geist fonts via `next/font/google` in `app/layout.tsx`:
   ```tsx
   import { Geist, Geist_Mono } from "next/font/google";
   const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
   const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
   ```
7. Ensure `<html data-theme="dark" className={`${sans.variable} ${mono.variable}`}>`.

**Checkpoint:** `pnpm build` passes. Existing pages look the same (maybe slightly different type). Commit: `chore: install design tokens`.

---

## Phase 1 — Atoms & Shared Components

Build the primitives from `components.md` in `components/ui/`:

- `components/ui/pip.tsx`
- `components/ui/live-dot.tsx` (or just use the CSS class)
- `components/ui/stat-cell.tsx`
- `components/ui/trend.tsx`
- `components/ui/section-card.tsx`
- `components/ui/segmented-tabs.tsx`
- `components/ui/tab-bar.tsx`
- `components/layout/app-shell.tsx` (top nav + optional bottom nav switch)

**Checkpoint:** Build passes. Render a test page at `/_design` that shows each atom. Commit: `feat(ui): atoms + app shell`.

---

## Phase 2 — League Overview (home)

Brief: `handoff/page-briefs/league-overview.md`.

Rebuild `app/[leagueId]/page.tsx` (or whatever the current route is) to match. Keep data-fetching 1:1 with current code — only the render tree changes.

**Checkpoint:** Mobile at 390px looks right. Commit: `ui: redesign league overview`.

---

## Phase 3 — Head-to-Head

**DEFERRED — pages do not exist in this codebase yet; revisit when the underlying routes/hooks are built.**

Brief: `handoff/page-briefs/head-to-head.md`. Commit: `ui: redesign h2h matchup`.

## Phase 4 — Roster Detail

**DEFERRED — pages do not exist in this codebase yet; revisit when the underlying routes/hooks are built.**

Brief: `handoff/page-briefs/roster.md`. Commit: `ui: redesign roster detail`.

## Phase 5 — Standings / Power Rankings

**DEFERRED — pages do not exist in this codebase yet; revisit when the underlying routes/hooks are built.**

Brief: `handoff/page-briefs/standings.md`. Commit: `ui: redesign standings`.

## Phase 6 — Player Detail

**DEFERRED — pages do not exist in this codebase yet; revisit when the underlying routes/hooks are built.**

Brief: `handoff/page-briefs/player.md`. Commit: `ui: redesign player detail`.

---

## Phase 7 — Sweep

**DEFERRED — runs after Phases 3–6 land; not yet applicable.**

- Remove dead CSS/classes from old design.
- Audit every page at 375, 430, 768, 1280, 1440.
- Accessibility pass: contrast ratios (AAA on body, AA min), focus rings, keyboard nav, `prefers-reduced-motion` on the LiveDot pulse.
- Lighthouse mobile ≥ 90 perf.

**Checkpoint:** Merge `ui-overhaul` → `main`.
