/**
 * Inline pill-style segmented control. `tabs` is an array of strings or
 * { value, label } objects. `value` controls the active tab.
 */
export function SegmentedTabs({ tabs, value, onChange, className = "" }) {
  const items = (tabs ?? []).map((t) =>
    typeof t === "string" ? { value: t, label: t } : t
  );

  return (
    <div
      className={`grid bg-bg-2 rounded-lg p-0.5 border border-line ${className}`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      role="tablist"
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(t.value)}
            className={`min-h-[36px] px-3 text-sm font-semibold rounded-md transition-colors duration-fast ${
              active
                ? "bg-bg-3 text-signal"
                : "text-text-dim hover:text-text"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedTabs;
