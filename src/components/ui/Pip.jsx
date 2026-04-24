import { getTeamHue } from "../../lib/theme";

/**
 * Circular team avatar with letter fallback. Color is deterministic from `seed`.
 * Falls back to a colored circle with up-to-2 initials drawn from `name`.
 */
export function Pip({ seed, name = "", size = 28, ring = false, className = "" }) {
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hue = getTeamHue(seed ?? name);

  return (
    <div
      className={`flex items-center justify-center shrink-0 text-white font-bold tracking-snug rounded-full ${
        ring ? "ring-2 ring-signal" : "ring-1 ring-white/10"
      } ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.4)),
        background: `oklch(62% 0.18 ${hue})`,
      }}
      aria-label={name || undefined}
    >
      {initials || "?"}
    </div>
  );
}

export default Pip;
