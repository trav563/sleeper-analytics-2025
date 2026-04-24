import { Pip } from "./Pip";
import { Trend } from "./Trend";

/**
 * Standings list row. Mobile grid: rank | pip | name | record | streak.
 * Pass `current` to wash the row with the team color (current user marker).
 *
 * Props:
 *   rank        — integer (1-indexed)
 *   seed        — team id used for color hue
 *   name        — team display name
 *   record      — string like "5-2" or "5-2-1"
 *   streak      — integer (positive = win streak, negative = loss streak)
 *   pf, pa      — optional points-for/points-against (desktop columns)
 *   power       — optional power rank delta vs last week
 *   current     — boolean: is this the active user's row
 */
export function TeamRow({
  rank,
  seed,
  name,
  record,
  streak = 0,
  pf,
  pa,
  power,
  current = false,
  className = "",
  onClick,
}) {
  const rankColor =
    rank <= 3 ? "text-signal" : rank <= 6 ? "text-text" : "text-text-mute";
  const streakLabel =
    streak === 0 ? "—" : `${streak > 0 ? "W" : "L"}${Math.abs(streak)}`;
  const streakColor =
    streak > 0 ? "text-good" : streak < 0 ? "text-bad" : "text-text-mute";

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`w-full text-left grid items-center gap-2 px-2 py-2.5 rounded-md transition-colors duration-fast hover:bg-bg-2 ${
        current ? "bg-bg-2" : ""
      } ${className}`}
      style={{
        gridTemplateColumns: "24px 28px 1fr 50px 36px",
      }}
    >
      <span className={`tnum text-xs font-bold ${rankColor}`}>{rank}</span>
      <Pip seed={seed ?? name} name={name} size={26} ring={current} />
      <span className="text-sm font-semibold truncate text-text">{name}</span>
      <span className="tnum text-sm text-text-dim text-right">{record}</span>
      <span className={`tnum text-xs font-semibold text-right ${streakColor}`}>
        {streakLabel}
      </span>

      {/* Desktop-only extra columns */}
      {(pf != null || pa != null || power != null) && (
        <div className="col-span-5 hidden md:flex items-center justify-end gap-4 text-xs text-text-dim font-mono">
          {pf != null && <span className="tnum">PF {pf}</span>}
          {pa != null && <span className="tnum">PA {pa}</span>}
          {power != null && (
            <span className="inline-flex items-center gap-1">
              POW <Trend v={power} />
            </span>
          )}
        </div>
      )}
    </Tag>
  );
}

export default TeamRow;
