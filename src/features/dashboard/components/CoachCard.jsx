import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAnalyzeTeam } from '../hooks/useAnalyzeTeam';

/**
 * Render the streamed markdown response. Reuses the same patterns as the
 * old AnalyzeMyTeam renderer (## headings, **bold**, - bullets) but stays
 * compact for the dashboard card form factor.
 */
function renderMarkdown(text) {
    if (!text) return null;
    const lines = text.split('\n');
    const out = [];
    lines.forEach((raw, i) => {
        const line = raw;
        if (!line.trim()) { out.push(<div key={i} className="h-2" />); return; }

        const h2 = line.match(/^##\s+(.+)$/);
        if (h2) {
            out.push(
                <h4 key={i} className="font-mono text-2xs font-bold uppercase tracking-wider text-signal mt-3 mb-1">
                    {h2[1]}
                </h4>
            );
            return;
        }

        let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-text">$1</strong>');
        processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');

        if (processed.match(/^[-*]\s+/)) {
            const content = processed.replace(/^[-*]\s+/, '');
            out.push(
                <div key={i} className="flex gap-2 py-0.5 text-xs text-text-dim leading-relaxed">
                    <span className="text-signal mt-1 shrink-0">&#8226;</span>
                    <span dangerouslySetInnerHTML={{ __html: content }} />
                </div>
            );
            return;
        }

        const num = processed.match(/^(\d+)\.\s+(.+)/);
        if (num) {
            out.push(
                <div key={i} className="flex gap-2 py-0.5 text-xs text-text-dim leading-relaxed">
                    <span className="font-mono font-semibold tnum text-signal shrink-0">{num[1]}.</span>
                    <span dangerouslySetInnerHTML={{ __html: num[2] }} />
                </div>
            );
            return;
        }

        out.push(
            <p
                key={i}
                className="text-xs text-text-dim leading-relaxed py-0.5"
                dangerouslySetInnerHTML={{ __html: processed }}
            />
        );
    });
    return out;
}

const CoachCard = ({
    icon: Icon,
    title,
    description,
    leagueId,
    userId,
    week,
    analysisType,
    cooldownMs,
    constraints = [],
}) => {
    const {
        analysis, loading, error, isOnCooldown, cooldownMinutes,
        activeConstraint, analyze,
    } = useAnalyzeTeam({ leagueId, userId, week, analysisType, cooldownMs });

    const hasResult = !!analysis;
    const cooldownLabel = cooldownMinutes >= 60
        ? `${Math.floor(cooldownMinutes / 60)}h ${cooldownMinutes % 60}m`
        : `${cooldownMinutes}m`;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card p-4 flex flex-col">
            <header className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                    {Icon && <Icon className="w-4 h-4 text-signal shrink-0" aria-hidden="true" />}
                    <h3 className="font-display text-sm font-bold text-text truncate">{title}</h3>
                </div>
                {!loading && (
                    <button
                        type="button"
                        onClick={() => analyze({ force: hasResult, constraint: activeConstraint })}
                        disabled={isOnCooldown && !hasResult}
                        className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wider font-bold text-signal hover:text-signal/80 transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {hasResult ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                        {hasResult ? 'Refresh' : 'Generate'}
                    </button>
                )}
            </header>
            {description && (
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-3">
                    {description}
                </p>
            )}

            {/* Body */}
            <div className="flex-1 min-h-[120px]">
                {loading && (
                    <div className="flex items-center justify-center h-[120px] gap-2">
                        <Loader2 className="w-4 h-4 text-signal animate-spin" />
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                            Analyzing…
                        </span>
                    </div>
                )}

                {!loading && error && (
                    <div className="p-3 rounded-md bg-bad/10 border border-bad/30 text-bad text-xs">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => analyze({ force: true, constraint: activeConstraint })}
                            className="mt-2 inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wider font-bold text-bad hover:text-bad/80 transition-colors duration-fast"
                        >
                            <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                    </div>
                )}

                {!loading && !error && !hasResult && (
                    <div className="flex flex-col items-center justify-center h-[120px] text-center px-2">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                            Tap Generate
                        </span>
                        {isOnCooldown && (
                            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                                Refresh available in {cooldownLabel}
                            </span>
                        )}
                    </div>
                )}

                {!loading && !error && hasResult && (
                    <div className="space-y-1">{renderMarkdown(analysis)}</div>
                )}
            </div>

            {/* Constraint buttons */}
            {hasResult && constraints.length > 0 && !loading && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-line">
                    {constraints.map((c) => {
                        const isActive = activeConstraint === c.value;
                        return (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => analyze({ force: false, constraint: c.value })}
                                className={`font-mono text-2xs uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors duration-fast ${
                                    isActive
                                        ? 'border-signal text-signal bg-signal/10'
                                        : 'border-line text-text-dim hover:border-line-strong hover:text-text'
                                }`}
                            >
                                {c.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Cooldown footer when result exists */}
            {hasResult && isOnCooldown && !loading && (
                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-2">
                    Next refresh in {cooldownLabel}
                </div>
            )}
        </section>
    );
};

export default CoachCard;
