# UI Overhaul — Handoff

This folder is a Claude Code–ready handoff package. Open your repo in VS Code, drop these files in, then ask Claude Code to apply them page by page.

## How to use with Claude Code in VS Code

1. **Copy this `handoff/` folder into your repo root.**
2. **Copy `CLAUDE.md` to your repo root** (same level as `package.json`). Claude Code auto-reads `CLAUDE.md` on every chat — this is the single most important file, because it anchors every future session to the new design system without you re-pasting context.
3. **Open a new Claude Code chat and say:**
   > Read `handoff/README.md` and `CLAUDE.md`, then start with Phase 1.
4. Work through the phases in order. Each phase ends with a commit checkpoint so you can review before moving on.

## Why this shape (vs one big prompt)

Claude Code's strength is **reading and editing real files in your repo**, not ingesting massive prompts. A file-based handoff means:

- Claude re-reads the tokens every time it touches a component — no drift.
- `CLAUDE.md` persists context across sessions; you don't re-brief.
- The `phases.md` plan is the work-breakdown — you can check off phases and resume on a new day.
- `components.md` is a pattern library Claude can grep when it needs to match existing patterns.

## Files in this folder

| File | What it is | Who reads it |
|---|---|---|
| `README.md` | This file. | You |
| `CLAUDE.md` | Move to repo root. Persistent project instructions. | Claude Code (auto) |
| `tokens.css` | Raw CSS variables — drop into `app/globals.css`. | Your app |
| `tailwind.config.ts` | Tailwind theme.extend that maps tokens → utility classes. | Tailwind build |
| `theme.ts` | TypeScript theme object for programmatic use. | Your JS |
| `components.md` | Atom/molecule patterns with exact class recipes. | Claude Code |
| `phases.md` | Ordered work plan. Commit after each phase. | You + Claude |
| `page-briefs/` | One Markdown file per redesigned page with the target layout. | Claude Code |

## Quick sanity check before starting

- [ ] Confirm Tailwind v3.4+ (needed for `fontFamily.sans` arrays + CSS var syntax used in config).
- [ ] Confirm Next.js App Router (briefs assume `app/` directory).
- [ ] Install fonts: `npm i @next/font` (or use `next/font/google` — already in Next 14+).
- [ ] Back up current branch: `git checkout -b ui-overhaul`.
