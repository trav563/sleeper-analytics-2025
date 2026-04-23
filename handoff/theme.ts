/**
 * Programmatic access to the token system (for JS that needs raw values).
 * Prefer Tailwind classes for JSX. Only import from theme.ts when you need
 * a value at runtime (e.g. SVG fills, chart libs, canvas).
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
    accent: "#F5B301",
    accent2: "#FF5A36",
    good: "#4ADE80",
    bad: "#F87171",
    warn: "#FBBF24",
    live: "#22E07A",
  },
  font: {
    sans: "Geist, ui-sans-serif, system-ui, sans-serif",
    display: "Geist, ui-sans-serif, system-ui, sans-serif",
    mono: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace",
  },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 20 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
  ease: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  },
  dur: { fast: 120, base: 200, slow: 400 },
} as const;

/** Deterministic hue for a team id/name — feeds oklch(62% 0.18 <hue>). */
export function getTeamHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function teamColor(seed: string, alpha = 1): string {
  return `oklch(62% 0.18 ${getTeamHue(seed)}${alpha < 1 ? ` / ${alpha}` : ""})`;
}
