# Component Patterns

Canonical atoms and molecules for the Broadcast Scoreboard system. Claude: grep this file before inventing a new pattern.

All examples use Tailwind classes backed by `tokens.css`. Assume React + TS.

---

## Atoms

### Pip — team avatar (circular, letter fallback)

```tsx
export function Pip({ seed, name, size = 28, ring = false }: {
  seed: string; name: string; size?: number; ring?: boolean;
}) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className={`flex items-center justify-center shrink-0 text-white font-bold tracking-snug rounded-full ${ring ? "ring-2 ring-accent" : "ring-1 ring-white/10"}`}
      style={{
        width: size, height: size, fontSize: size * 0.4,
        background: `oklch(62% 0.18 ${hueFor(seed)})`,
      }}
    >{initials}</div>
  );
}
```

### LiveDot — pulsing coral signal

```tsx
<span className="live-dot" /> // class defined in tokens.css
```

Use only for in-play state. Not for generic "new" indicators (use a static `bg-accent` dot for those).

### StatCell — metric block for hero strips

```tsx
<div className="rounded-lg bg-bg-2 border border-line px-4 py-3 text-center">
  <div className="text-2xs text-text-mute font-bold tracking-wider">LIVE</div>
  <div className="tnum font-display font-extrabold text-4xl tracking-tight mt-1">138.4</div>
</div>
```

### Trend — ▲/▼ delta

```tsx
export function Trend({ v }: { v: number }) {
  if (v === 0) return <span className="font-mono text-text-dim">—</span>;
  return (
    <span className={`font-mono text-xs font-semibold ${v > 0 ? "text-good" : "text-bad"}`}>
      {v > 0 ? "▲" : "▼"}{Math.abs(v)}
    </span>
  );
}
```

### SectionCard — every grouped content block

```tsx
<section className="rounded-xl bg-bg-1 border border-line p-4 shadow-card">
  {/* ... */}
</section>
```

### Eyebrow label — all-caps metadata header

```tsx
<div className="text-2xs font-bold tracking-wider text-text-mute">CURRENT RANK</div>
```

### AI badge

```tsx
<span className="text-2xs font-extrabold tracking-wider px-1.5 py-0.5 rounded-sm text-[#0B0C10]"
  style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }}>
  AI
</span>
```

---

## Molecules

### MatchupHero — two teams, big scores, win probability bar

Structure:
- Eyebrow: `LIVE · WEEK 8 · Q3 9:42` with `<LiveDot/>`
- Grid `1fr auto 1fr`: left team / vs pod / right team
- Each team block: `<Pip size={56|80}/>` + record label + **hero score** (text-4xl mobile, text-5xl desktop) + projected sub
- Leading team's score: `text-accent shadow-[glow-accent]`
- Bottom: 4–6px gradient progress bar from `accent` → `good` showing win probability

Mobile stacks nothing — use compact pips (56) and text-4xl.

### PositionRow — side-by-side H2H row

Three-column grid `1fr 60px 1fr`. Left cell right-aligned. Center: slot chip (`QB` `RB` `FLEX`) + delta. Right cell left-aligned.

Each player cell:
- Name (text-sm, fw-semibold, truncate)
- Meta line (font-mono, text-2xs): `{team} · {status} · proj {n}` — tint `text-accent-2` when LIVE
- Score (tnum, text-lg fw-extrabold). Winner colored `text-good`.

### TeamRow — standings list item

Grid `24px 26px 1fr 40px 50px 32px` on mobile. On desktop add PA + Power columns.
- Rank: top 3 → `text-accent`, 4–6 → `text-text`, 7+ → `text-text-mute`.
- When row is the current user, wash background with `team-tint-soft`.
- Streak tinted `text-good` / `text-bad`.

### TabBar — mobile bottom nav

Pill-shaped, floating 12px from edge, backdrop-blur. 5 tabs max. 44×44 min tap target. Active tab: `bg-bg-3 text-accent` with `tt(accent, 0.12)` wash.

### SegmentedTabs — inline segmented pill

```tsx
<div className="grid grid-cols-3 bg-bg-2 rounded-lg p-0.5 border border-line">
  {tabs.map((t, i) => (
    <button className={`py-2 text-sm font-semibold rounded-md ${active === i ? "bg-bg-3 text-accent" : "text-text-dim"}`}>{t}</button>
  ))}
</div>
```

---

## Layout primitives

- **Page background**: `bg-bg` with optional team-colored radial gradient overlay at top when the page is team-scoped.
- **Sticky mobile header**: position above safe-area inset, 54px top pad for status bar simulation (prod: use `env(safe-area-inset-top)`).
- **Card gap**: 14–16px between sibling cards, 20px between sections.
- **Page padding**: 16px mobile, 28px desktop.
- **Max content width**: none — let the grid breathe on widescreen but cap hero width at `max-w-[1440px] mx-auto`.

---

## Don'ts

- Don't use proportional digits for scores, ranks, points. Always `.tnum`.
- Don't introduce shadows beyond `shadow-card`, `shadow-pop`, and the two glows. Layered glows get noisy.
- Don't use `accent-2` (coral) for non-live things like warnings — use `warn` (amber).
- Don't hand-pick team colors. Always `teamColor(seed)` from `theme.ts` or the `--h` CSS var.
- Don't set raw hex in JSX. If you need a color, it's a token or it's wrong.
