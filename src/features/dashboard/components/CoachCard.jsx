import { Loader2, RefreshCw } from 'lucide-react';
import { useAnalyzeTeam } from '../hooks/useAnalyzeTeam';

/**
 * Escape HTML metacharacters, then apply the inline markdown patterns
 * (**bold**, *em*). The model output echoes Sleeper-sourced strings (team
 * names etc.), so it must never reach dangerouslySetInnerHTML unescaped.
 */
export function formatInlineMarkdown(line) {
    const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-text">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

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

        const processed = formatInlineMarkdown(line);

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

const CoachCard = ({ icon: Icon, title, description, leagueId, userId, week, analysisType, cooldownMs, constraints = [] }) => {
    const { analysis, loading, error, incomplete, valuation, cachedAt, cooldownMinutes, activeConstraint, analyze, cancel } = useAnalyzeTeam({ leagueId, userId, week, analysisType, cooldownMs });
    const activeTitle = activeConstraint === 'trade-up' ? 'Trade-up Ideas' : activeConstraint === 'sell-high' ? 'Sell-high Candidates' : title;
    const activeDescription = activeConstraint === 'trade-up' ? 'Screened consolidation packages' : activeConstraint === 'sell-high' ? 'Screened market-value opportunities' : description;
    const modes = [{ value: null, label: analysisType === 'roster' ? 'Roster grades' : 'Overview' }, ...constraints];
    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card p-4 flex flex-col min-w-0">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-text">
                    {Icon && <Icon className="w-5 h-5 text-signal shrink-0" aria-hidden="true" />}{activeTitle}
                </h3>
                <button type="button" onClick={() => loading ? cancel() : analyze({ force: !!analysis, constraint: activeConstraint })}
                    className="min-h-11 px-2 text-sm font-semibold text-signal inline-flex items-center gap-1">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {loading ? 'Cancel' : analysis ? 'Refresh' : 'Generate'}
                </button>
            </header>
            <p className="text-xs text-text-dim mb-3">{activeDescription}</p>
            <div className="flex flex-wrap gap-2 mb-4" aria-label={`${title} analysis mode`}>
                {modes.map(mode => <button type="button" key={mode.value || 'default'} aria-pressed={activeConstraint === mode.value}
                    onClick={() => analyze({ constraint: mode.value })}
                    className={`min-h-11 px-3 rounded-md border text-sm ${activeConstraint === mode.value ? 'border-signal text-signal bg-signal/10' : 'border-line text-text-dim hover:text-text'}`}>{mode.label}</button>)}
            </div>
            {loading && <p role="status" className="text-sm text-signal mb-3">Analyzing… Results appear as they arrive.</p>}
            {error && <div role="alert" className="p-3 mb-3 rounded-md bg-bad/10 text-bad text-sm">
                <p>{error}</p><button type="button" className="min-h-11 underline" onClick={() => analyze({ force: true, constraint: activeConstraint })}>Retry analysis</button>
            </div>}
            {analysis ? <div className="coach-result space-y-1 break-words">{renderMarkdown(analysis)}</div>
                : !loading && !error && <p className="py-8 text-sm text-text-dim">Choose a mode or select Generate to analyze this team.</p>}
            <footer className="mt-4 text-xs text-text-dim">
                {valuation && <p className="mb-1">Market values: {valuation.source}{valuation.fetchedAt ? ` · retrieved ${new Date(valuation.fetchedAt).toLocaleString()}` : ""}. {valuation.approximation}</p>}
                {incomplete && !loading ? 'Incomplete · not saved' : cachedAt ? `Completed ${new Date(cachedAt).toLocaleString()}` : ''}
                {!incomplete && cachedAt && cooldownMinutes > 0 && <span className="block mt-1">Saved result reused for {cooldownMinutes >= 60 ? `${Math.ceil(cooldownMinutes / 60)}h` : `${cooldownMinutes}m`}. Refresh requests a new analysis.</span>}
            </footer>
        </section>
    );
};

export default CoachCard;
