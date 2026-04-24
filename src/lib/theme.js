/**
 * Programmatic access to the Broadcast Scoreboard token system.
 * Prefer Tailwind classes for JSX. Import from here only when you need
 * a value at runtime — e.g. recharts stroke/fill, SVG fills, canvas.
 *
 * Note: handoff/theme.ts uses `accent` / `accent2` for the gold/coral
 * signal colors. Here they are renamed to `signal` / `signal2` to avoid
 * colliding with shadcn's existing gray --accent token.
 */
export const theme = {
  color: {
    bg: "#07080A",
    bg1: "#0F1115",
    bg2: "#161920",
    bg3: "#1E222B",
    text: "#F5F6F8",
    textDim: "#9097A3",
    textMute: "#5A6170",
    line: "rgba(255,255,255,0.06)",
    lineStrong: "rgba(255,255,255,0.12)",
    signal: "#F5B301",
    signal2: "#FF5A36",
    good: "#4ADE80",
    bad: "#F87171",
    warn: "#FBBF24",
    live: "#22E07A",
  },
  font: {
    sans: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    display: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace',
  },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 20 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
  ease: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  },
  dur: { fast: 120, base: 200, slow: 400 },
};

/** Deterministic hue (0-359) for a team id/name — feeds oklch(62% 0.18 <hue>). */
export function getTeamHue(seed) {
  const s = String(seed ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Returns an oklch() team color string. */
export function teamColor(seed, alpha = 1) {
  const hue = getTeamHue(seed);
  return `oklch(62% 0.18 ${hue}${alpha < 1 ? ` / ${alpha}` : ""})`;
}
