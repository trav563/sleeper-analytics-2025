import { useState, useRef } from 'react';
import { Brain, Sparkles, ChevronDown, ChevronUp, Loader2, AlertCircle, X, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useAnalyzeTeam } from '../hooks/useAnalyzeTeam';

const ANALYSIS_TYPES = [
    { value: 'full', label: 'Full Analysis', description: 'Complete roster breakdown' },
    { value: 'startsit', label: 'Start/Sit', description: 'Lineup decisions' },
    { value: 'waivers', label: 'Waiver Targets', description: 'Free agent picks' },
    { value: 'trades', label: 'Trade Ideas', description: 'Buy low / sell high' },
    { value: 'playoff', label: 'Playoff Path', description: 'Season outlook' },
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
    // Parse markdown table lines into header + rows
    const rows = lines.filter(l => l.trim() && !l.match(/^\|[-\s|]+\|$/)); // Skip separator rows
    if (rows.length === 0) return null;

    const parseRow = (line) => line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
    const headerCells = parseRow(rows[0]);
    const bodyRows = rows.slice(1).map(parseRow);

    return (
        <div className="my-2">
            <table className="w-full text-xs table-fixed">
                <thead>
                    <tr className="border-b border-slate-700">
                        {headerCells.map((cell, i) => (
                            <th key={i} className="px-2 py-1.5 text-left text-slate-400 font-medium whitespace-nowrap">{cell}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bodyRows.map((cells, ri) => (
                        <tr key={ri} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                            {cells.map((cell, ci) => (
                                <td key={ci} className={`px-2 py-1.5 text-slate-300 ${ci < 2 ? 'whitespace-nowrap' : ''}`} dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
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

        // Collect consecutive table lines
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

        let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Bullet points
        if (processed.match(/^[-*] /)) {
            const content = processed.replace(/^[-*] /, '');
            elements.push(
                <div key={i} className="flex gap-2 py-0.5">
                    <span className="text-primary mt-1 shrink-0">&#8226;</span>
                    <span dangerouslySetInnerHTML={{ __html: content }} />
                </div>
            );
            i++; continue;
        }

        // Numbered list
        const numMatch = processed.match(/^(\d+)\. (.+)/);
        if (numMatch) {
            elements.push(
                <div key={i} className="flex gap-2 py-0.5">
                    <span className="text-primary font-medium shrink-0">{numMatch[1]}.</span>
                    <span dangerouslySetInnerHTML={{ __html: numMatch[2] }} />
                </div>
            );
            i++; continue;
        }

        // H3
        if (processed.startsWith('### ')) {
            elements.push(<h4 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{processed.replace('### ', '')}</h4>);
            i++; continue;
        }

        elements.push(<p key={i} className="py-0.5" dangerouslySetInnerHTML={{ __html: processed }} />);
        i++;
    }

    return elements;
}

const SECTION_ICONS = {
    'Roster Grade': '📊',
    'Start/Sit': '🏈',
    'Optimal Lineup': '🏈',
    'Waiver Wire': '🎯',
    'Trade': '🔄',
    'Outlook': '🔮',
    'Playoff': '🏆',
    'Key Decisions': '🤔',
    'Key Matchups': '📅',
    'Strategy': '🎯',
    'Summary': '📋',
    'Bench': '💺',
};

function getSectionIcon(title) {
    for (const [key, icon] of Object.entries(SECTION_ICONS)) {
        if (title.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return '📋';
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

const AnalyzeMyTeam = ({ leagueId, userId, week, marketValues }) => {
    const [analysisType, setAnalysisType] = useState('full');

    const {
        analysis, loading, error, remaining,
        cachedAt, isOnCooldown, cooldownMinutes,
        analyze, cancel, clear
    } = useAnalyzeTeam({ leagueId, userId, week, analysisType, marketValues });

    const [expandedSections, setExpandedSections] = useState(new Set());
    const [showTypeMenu, setShowTypeMenu] = useState(false);
    const contentRef = useRef(null);

    const selectedType = ANALYSIS_TYPES.find(t => t.value === analysisType);
    const sections = parseMarkdownSections(analysis);
    const hasResult = analysis.length > 0;
    const valuesLoaded = marketValues && Object.keys(marketValues).length > 0;

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
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/20 rounded-lg">
                            <Brain className="w-5 h-5 text-purple-400" />
                        </div>
                        <CardTitle className="text-lg font-semibold text-foreground">
                            Analyze My Team
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-500/15 text-purple-400 border-purple-500/30">
                            AI
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {cachedAt && !loading && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(cachedAt)}
                            </span>
                        )}
                        {remaining !== null && (
                            <span className="text-xs text-slate-500">
                                {remaining} left today
                            </span>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                {/* Controls */}
                <div className="flex items-center gap-2 mb-4">
                    {/* Analysis Type Selector */}
                    <div className="relative flex-1">
                        <button
                            onClick={() => setShowTypeMenu(!showTypeMenu)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-foreground hover:border-slate-500 transition-colors"
                            disabled={loading}
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                <span>{selectedType?.label}</span>
                                <span className="text-xs text-slate-500 hidden sm:inline">— {selectedType?.description}</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>

                        {showTypeMenu && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 overflow-hidden">
                                {ANALYSIS_TYPES.map(type => (
                                    <button
                                        key={type.value}
                                        onClick={() => { setAnalysisType(type.value); setShowTypeMenu(false); }}
                                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors ${
                                            analysisType === type.value ? 'bg-slate-700/50 text-purple-400' : 'text-foreground'
                                        }`}
                                    >
                                        <div className="font-medium">{type.label}</div>
                                        <div className="text-xs text-slate-500">{type.description}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Analyze / Cancel / Cooldown Button */}
                    {loading ? (
                        <Button onClick={cancel} variant="destructive" size="sm" className="shrink-0">
                            <X className="w-4 h-4 mr-1" />
                            Stop
                        </Button>
                    ) : isOnCooldown ? (
                        <Button onClick={() => handleAnalyze(true)} size="sm" className="shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-300">
                            <Sparkles className="w-4 h-4 mr-1" />
                            Refresh
                        </Button>
                    ) : !valuesLoaded && !hasResult ? (
                        <Button disabled size="sm" className="shrink-0 bg-slate-700 text-slate-400">
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Loading...
                        </Button>
                    ) : (
                        <Button onClick={() => handleAnalyze(false)} size="sm" className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white">
                            <Sparkles className="w-4 h-4 mr-1" />
                            {hasResult ? 'Re-analyze' : 'Analyze'}
                        </Button>
                    )}
                </div>

                {/* Error State */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-400 mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                        <button onClick={clear} className="ml-auto text-rose-400/60 hover:text-rose-400">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading && !hasResult && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                            <Loader2 className="w-8 h-8 text-purple-400 animate-spin relative" />
                        </div>
                        <p className="text-sm text-slate-400 animate-pulse">Analyzing your roster...</p>
                    </div>
                )}

                {/* Results */}
                {hasResult && (
                    <div ref={contentRef} className="space-y-2">
                        {sections.map((section, idx) => {
                            const collapsed = isSectionCollapsed(idx);
                            const icon = getSectionIcon(section.title);

                            if (!section.title) {
                                return (
                                    <div key={idx} className="text-sm text-slate-300 leading-relaxed">
                                        {renderMarkdown(section.content)}
                                    </div>
                                );
                            }

                            return (
                                <div key={idx} className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection(idx)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{icon}</span>
                                            <span className="text-sm font-semibold text-foreground">{section.title}</span>
                                        </div>
                                        {collapsed ? (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                        ) : (
                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                        )}
                                    </button>
                                    {!collapsed && (
                                        <div className="px-4 pb-3 text-sm text-slate-300 leading-relaxed border-t border-slate-700/30">
                                            <div className="pt-3">
                                                {renderMarkdown(section.content)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Streaming indicator */}
                        {loading && (
                            <div className="flex items-center gap-2 px-2 py-1">
                                <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                                <span className="text-xs text-slate-500">Generating analysis...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !hasResult && !error && (
                    <div className="text-center py-6">
                        <Brain className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">
                            Get AI-powered insights on your roster, lineup decisions, and trade opportunities.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default AnalyzeMyTeam;
