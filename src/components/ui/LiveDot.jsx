/**
 * Pulsing coral signal — use ONLY for in-play state. For generic "new"
 * indicators, use a static <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal" />.
 */
export function LiveDot({ className = "", label = "Live" }) {
  return (
    <span
      className={`live-dot ${className}`}
      role="status"
      aria-label={label}
    />
  );
}

export default LiveDot;
