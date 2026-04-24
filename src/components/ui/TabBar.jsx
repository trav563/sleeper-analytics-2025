/**
 * Floating bottom mobile nav. `items` is an array of
 * { value, label, icon (optional ReactNode) }. Renders pill-shaped, fixed
 * 12px from the bottom edge, backdrop-blurred. Cap to 5 items.
 *
 * For accessibility: each item is a 44×44 minimum tap target.
 */
export function TabBar({ items, value, onChange, className = "" }) {
  const tabs = (items ?? []).slice(0, 5);
  return (
    <nav
      className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-40 backdrop-blur-md bg-bg-1/85 border border-line rounded-full shadow-pop px-1 py-1 ${className}`}
      aria-label="Primary"
    >
      <div className="flex items-center gap-0.5">
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange?.(t.value)}
              className={`min-w-[44px] min-h-[44px] px-3 rounded-full flex items-center gap-2 text-xs font-semibold transition-colors duration-fast ${
                active
                  ? "bg-bg-3 text-signal"
                  : "text-text-dim hover:text-text"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t.icon}
              <span className={t.icon ? "hidden sm:inline" : ""}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default TabBar;
