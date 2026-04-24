import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useAnalyzeTeam } from '../hooks/useAnalyzeTeam';
import { LiveDot } from '../../../components/ui/LiveDot';

/* Parse the AI markdown into [{ tag, heading, body }] cards. */
const parseSections = (md, max = 3) => {
    if (!md) return [];
    const lines = md.split('\n');
    const out = [];
    let cur = null;
    for (const ln of lines) {
        const h = ln.match(/^##\s+(.+)$/);
        if (h) {
            if (cur) out.push(cur);
            cur = { heading: h[1].trim(), body: '' };
            continue;
        }
        if (cur) {
            cur.body += ln + '\n';
        }
    }
    if (cur) out.push(cur);
    return out.slice(0, max).map((s) => {
        const tag = s.heading.split(/[/·:]/)[0].trim().slice(0, 14).toUpperCase();
        const body = s.body.replace(/^\s+|\s+$/g, '').slice(0, 220);
        return { tag, heading: s.heading, body };
    });
};

/** Coach's Take strip — horizontal AI insight cards. */
const Insights = ({ leagueId, userId, week }) => {
    const { analysis, loading, analyze, isOnCooldown, remaining, cachedAt } = useAnalyzeTeam({
        leagueId,
        userId,
        week,
        analysisType: 'full',
    });
    const cards = useMemo(() => parseSections(analysis, 3), [analysis]);

    return (
        <section className="bg-bg-1 rounded-xl border border-line p-4 shadow-card">
            <header className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className="font-mono text-2xs font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-ink shrink-0"
                        style={{ background: 'linear-gradient(90deg, var(--signal), var(--signal-2))' }}
                    >
                        AI
                    </span>
                    <h3 className="font-display text-md font-semibold text-text">Coach's Take</h3>
                    {loading && <LiveDot label="Generating" />}
                </div>
                {!loading && !cards.length && !isOnCooldown && (
                    <button
                        type="button"
                        onClick={() => analyze({ force: false })}
                        className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wider font-bold text-signal hover:text-signal/80 transition-colors duration-fast"
                    >
                        <Sparkles className="w-3 h-3" /> Generate
                    </button>
                )}
                {!loading && cards.length > 0 && (
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        {remaining != null && remaining < 999 && (
                            <><span className="tnum">{remaining}</span> left</>
                        )}
                    </span>
                )}
            </header>

            {loading && cards.length === 0 ? (
                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute py-4 text-center">
                    Analyzing roster…
                </div>
            ) : cards.length === 0 ? (
                <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 rounded-md border border-dashed border-line bg-bg-2/30 flex items-center justify-center">
                            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Tap Generate</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {cards.map((c, i) => (
                        <article
                            key={i}
                            className="shrink-0 w-[260px] rounded-md p-3 bg-bg-2 border border-line"
                        >
                            <div className="font-mono text-2xs font-bold uppercase tracking-wider text-signal mb-1.5">
                                {c.tag}
                            </div>
                            <h4 className="text-sm font-bold text-text leading-tight mb-1">{c.heading}</h4>
                            <p className="text-xs text-text-dim leading-relaxed line-clamp-4">{c.body}</p>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};

export default Insights;
