/**
 * Metric block for hero strips. Eyebrow caps label + big tabular number.
 * Pass `tone="signal"` to highlight (gold). `tone="live"` adds the glow.
 */
export function StatCell({ label, value, tone = "default", className = "" }) {
  const valueTone =
    tone === "signal"
      ? "text-signal"
      : tone === "live"
      ? "text-signal-2"
      : "text-text";

  return (
    <div
      className={`rounded-lg bg-bg-2 border border-line px-4 py-3 text-center ${className}`}
    >
      <div className="text-2xs text-text-mute font-bold tracking-wider uppercase">
        {label}
      </div>
      <div
        className={`tnum font-display font-extrabold text-[44px] leading-none tracking-tight mt-1 ${valueTone}`}
      >
        {value}
      </div>
    </div>
  );
}

export default StatCell;
