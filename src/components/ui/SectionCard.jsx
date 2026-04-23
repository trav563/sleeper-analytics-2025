/**
 * Every grouped content block on a Broadcast Scoreboard page wraps in this.
 * Optional `title` and `eyebrow` headers. `as` lets you swap the element tag.
 */
export function SectionCard({
  children,
  title,
  eyebrow,
  action,
  className = "",
  as: Tag = "section",
}) {
  return (
    <Tag
      className={`rounded-xl bg-bg-1 border border-line p-4 shadow-card ${className}`}
    >
      {(title || eyebrow || action) && (
        <header className="flex items-end justify-between gap-3 mb-3">
          <div>
            {eyebrow && (
              <div className="text-2xs font-bold tracking-wider uppercase text-text-mute">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="font-display font-semibold text-md text-text">
                {title}
              </h2>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

export default SectionCard;
