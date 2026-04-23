import { useState, useRef } from 'react';
import { Brain, Sparkles, ChevronDown, ChevronUp, Loader2, AlertCircle, X, Clock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useAnalyzeTeam } from '../hooks/useAnalyzeTeam';

const ANALYSIS_TYPES = [
    { value: 'full',     label: 'Full Analysis',  description: 'Complete roster breakdown' },
    { value: 'startsit', label: 'Start/Sit',      description: 'Lineup decisions' },
    { value: 'waivers',  label: 'Waiver Targets', description: 'Free agent picks' },
    { value: 'playoff',  label: 'Playoff Path',   description: 'Season outlook' },
];

function parseMarkdownSections(text) {
    if (!text) return [];
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;

    for (const line of lines) {
        const h2Match = line.match(/^## (.+)/);
        if (h2Match) {
            if (currentSection) sections.push(currentSection);
            currentSection = { title: h2Match[1], content: '' };
        } else if (currentSection) {
            currentSection.content += line + '\n';
        } else {
            if (!sections.length && line.trim()) {
                if (!currentSection) currentSection = { title: '', content: '' };
                currentSection.content += line + '\n';
            }
        }
    }
    if (currentSection) sections.push(currentSection);
    return sections;
}

function renderMarkdownTable(lines) {
    const rows = lines.filter(l => l.trim() && !l.match(/^\|[-\s|]+\|$/));
    if (rows.length === 0) return null;

    const parseRow = (line) => line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
    const headerCells = parseRow(rows[0]);
    const bodyRows = rows.slice(1).map(parseRow);

    return (
        <div className="my-2 overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-line">
                        {headerCells.map((cell, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-mono text-2xs uppercase tracking-wider text-text-mute font-bold whitespace-nowrap">
                                {cell}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bodyRows.map((cells, ri) => (
                        <tr key={ri} className="border-b border-line/60 hover:bg-bg-2/40">
                            {cells.map((cell, ci) => (
                                <td
                                    key={ci}
                                    className={`px-2 py-1.5 text-text-dim ${ci < 2 ? 'whitespace-nowrap' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.+?)\*\*/g, '<strong class="text-text">$1</strong>') }}
                                />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function renderMarkdown(text) {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.trimStart().startsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trimStart().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            elements.push(<div key={`table-${i}`}>{renderMarkdownTable(tableLines)}</div>);
            continue;
        }

        if (!line.trim()) { elements.push(<br key={i} />); i++; continue; }

        let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-text">$1</strong>');
        processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');

        if (processed.match(/^[-*] /)) {
            const content = processed.replace(/^[-*] /, '');
            elements.push(
                <div key={i} className="flex gap-2 py-0.5">
                    <span className="text-signal mt-1 shrink-0">&#8226;</span>
                    <span dangerouslySetInnerHTML={{ __html: content }} />
                </div>
            );
            i++; continue;
        }

        const numMatch = processed.match(/^(\d+)\. (.+)/);
        if (numMatch) {
            elements.push(
                <div key={i} className="flex gap-2 py-0.5">
                    <span className="text-signal font-mono font-semibold tnum shrink-0">{numMatch[1]}.</span>
                    <span dangerouslySetInnerHTML={{ __html: numMatch[2] }} />
                </div>
            );
            i++; continue;
        }

        if (processed.startsWith('### ')) {
            elements.push(<h4 key={i} className="font-display text-sm font-semibold text-text mt-3 mb-1">{processed.replace('### ', '')}</h4>);
            i++; continue;
        }

        elements.push(<p key={i} className="py-0.5" dangerouslySetInnerHTML={{ __html: processed }} />);
        i++;
    }

    return elements;
}

const SECTION_ICONS = {
    'Roster Grade': '◉',
    'Start/Sit':    '◆',
    'Optimal Lineup': '◆',
    'Waiver Wire':  '◇',
    'Outlook':      '◯',
    'Playoff':      '★',
    'Season Preview': '★',
    'Key Decisions': '◐',
    'Key Matchups': '▣',
    'Strategy':     '◇',
    'Summary':      '▤',
    'Roster Readiness': '▤',
    'Offseason':    '▤',
};

function getSectionIcon(title) {
    for (const [key, icon] of Object.entries(SECTION_ICONS)) {
        if (title.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '▤';
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
}

const AnalyzeMyTeam = ({ leagueId, userId, week }) => {
    const [analysisType, setAnalysisType] = useState('full');

    const {
        analysis, loading, error, remaining,
        cachedAt, isOnCooldown,
        analyze, cancel, clear,
    } = useAnalyzeTeam({ leagueId, userId, week, analysisType });

    const [expandedSections, setExpandedSections] = useState(new Set());
    const [showTypeMenu, setShowTypeMenu] = useState(false);
    const contentRef = useRef(null);

    const selectedType = ANALYSIS_TYPES.find(t => t.value === analysisType);
    const sections = parseMarkdownSections(analysis);
    const hasResult = analysis.length > 0;

    const handleAnalyze = (force = false) => {
        setExpandedSections(new Set());
        analyze({ force });
    };

    const toggleSection = (idx) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const isSectionCollapsed = (idx) => expandedSections.has(idx);

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card">
            <header className="px-4 pt-4 pb-3 border-b border-line">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-bg-3 rounded-md border border-line">
                            <Brain className="w-4 h-4 text-signal" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Tool · AI Analysis
                            </div>
                            <h3 className="font-display text-lg font-semibold text-text flex items-center gap-2">
                                Analyze My Team
                                <span
                                    className="font-mono text-2xs font-extrabold tracking-wider px-1.5 py-0.5 rounded-sm text-ink uppercase"
                                    style={{ background: 'linear-gradient(90deg, var(--signal), var(--signal-2))' }}
                                >
                                    AI
                                </span>
                            </h3>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                        {cachedAt && !loading && (
                            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(cachedAt)}
                            </span>
                        )}
                        {remaining !== null && (
                            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                <span className="tnum text-text-dim">{remaining}</span> left today
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <div className="px-4 pt-4 pb-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <button
                            type="button"
                            onClick={() => setShowTypeMenu(!showTypeMenu)}
                            className="w-full min-h-[40px] flex items-center justify-between px-3 py-2 bg-bg-2 border border-line rounded-md text-sm text-text hover:bg-bg-3 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-50"
                            disabled={loading}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Sparkles className="w-3.5 h-3.5 text-signal shrink-0" aria-hidden="true" />
                                <span className="truncate">{selectedType?.label}</span>
                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute hidden sm:inline truncate">
                                    · {selectedType?.description}
                                </span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-text-dim shrink-0" />
                        </button>

                        {showTypeMenu && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-bg-1 border border-line rounded-md shadow-pop z-10 overflow-hidden">
                                {ANALYSIS_TYPES.map(type => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => { setAnalysisType(type.value); setShowTypeMenu(false); }}
                                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-bg-2 transition-colors duration-fast border-b border-line/60 last:border-0 ${
                                            analysisType === type.value ? 'bg-bg-2 text-signal' : 'text-text'
                                        }`}
                                    >
                                        <div className="font-semibold">{type.label}</div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">{type.description}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <Button onClick={cancel} size="sm" className="shrink-0 min-h-[40px] bg-bad text-text hover:bg-bad/80">
                            <X className="w-4 h-4 mr-1" />
                            Stop
                        </Button>
                    ) : isOnCooldown ? (
                        <Button onClick={() => handleAnalyze(true)} size="sm" className="shrink-0 min-h-[40px] bg-bg-2 hover:bg-bg-3 text-text border border-line">
                            <Sparkles className="w-4 h-4 mr-1" />
                            Refresh
                        </Button>
                    ) : (
                        <Button onClick={() => handleAnalyze(false)} size="sm" className="shrink-0 min-h-[40px] bg-signal text-ink font-semibold hover:bg-signal/90">
                            <Sparkles className="w-4 h-4 mr-1" />
                            {hasResult ? 'Re-analyze' : 'Analyze'}
                        </Button>
                    )}
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-bad/10 border border-bad/30 rounded-md text-sm text-bad mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{error}</span>
                        <button type="button" onClick={clear} className="text-bad/60 hover:text-bad" aria-label="Dismiss error">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {loading && !hasResult && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-signal/20 rounded-full blur-xl animate-pulse" />
                            <Loader2 className="w-7 h-7 text-signal animate-spin relative" />
                        </div>
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute animate-pulse">
                            Analyzing your roster…
                        </p>
                    </div>
                )}

                {hasResult && (
                    <div ref={contentRef} className="space-y-2">
                        {sections.map((section, idx) => {
                            const collapsed = isSectionCollapsed(idx);
                            const icon = getSectionIcon(section.title);

                            if (!section.title) {
                                return (
                                    <div key={idx} className="text-sm text-text-dim leading-relaxed">
                                        {renderMarkdown(section.content)}
                                    </div>
                                );
                            }

                            return (
                                <div key={idx} className="bg-bg-2 rounded-md border border-line">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(idx)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-3 transition-colors duration-fast"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-signal font-mono">{icon}</span>
                                            <span className="text-sm font-semibold text-text">{section.title}</span>
                                        </div>
                                        {collapsed
                                            ? <ChevronDown className="w-4 h-4 text-text-dim" />
                                            : <ChevronUp className="w-4 h-4 text-text-dim" />}
                                    </button>
                                    {!collapsed && (
                                        <div className="px-4 pb-3 text-sm text-text-dim leading-relaxed border-t border-line">
                                            <div className="pt-3">
                                                {renderMarkdown(section.content)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="flex items-center gap-2 px-2 py-1">
                                <Loader2 className="w-3 h-3 text-signal animate-spin" />
                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Generating analysis…</span>
                            </div>
                        )}
                    </div>
                )}

                {!loading && !hasResult && !error && (
                    <div className="text-center py-6 space-y-2">
                        <Brain className="w-9 h-9 text-text-mute mx-auto" aria-hidden="true" />
                        <p className="text-sm text-text-dim max-w-md mx-auto">
                            Get AI-powered insights on your roster, lineup decisions, and waiver targets.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default AnalyzeMyTeam;
