/**
 * Up/down delta indicator. Positive → green ▲, negative → red ▼, zero → dim em-dash.
 */
export function Trend({ v, className = "" }) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) {
    return <span className={`font-mono text-text-dim ${className}`}>—</span>;
  }
  const positive = n > 0;
  return (
    <span
      className={`font-mono text-xs font-semibold tnum ${
        positive ? "text-good" : "text-bad"
      } ${className}`}
    >
      {positive ? "▲" : "▼"}
      {Math.abs(n)}
    </span>
  );
}

export default Trend;
