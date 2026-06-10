import { useState } from 'react';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Sparkles, BrainCircuit, TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';

const TeamAnalyzer = ({ league, roster }) => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/analyze-roster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ league, roster })
            });

            if (!res.ok) {
                let errData;
                try {
                    errData = await res.json();
                } catch (jsonErr) {
                    // Response is not JSON (Server crashed, or 404 because running 'npm run dev' instead of 'vercel dev')
                    if (res.status === 404) {
                        throw new Error("API endpoint not found (404). If testing locally, ensure you run 'vercel dev' instead of 'npm run dev' to mount serverless functions.");
                    }
                    throw new Error(`Server returned ${res.status}: ${res.statusText} (Unable to parse JSON error response)`);
                }
                const errorMessage = errData.details ? `${errData.error}: ${errData.details}` : (errData.error || 'Failed to analyze team');
                throw new Error(errorMessage);
            }

            let data;
            try {
                data = await res.json();
            } catch (jsonErr) {
                throw new Error("Server returned a non-JSON response. If testing locally, ensure you are running 'vercel dev' to mount serverless functions.");
            }
            setReport(data);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!league || !roster) return null;

    return (
        <Card className="bg-slate-900 border-indigo-500/30 mb-6 relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/10 to-purple-900/10 pointer-events-none" />

            <CardContent className="p-6 relative z-10">
                {!report && !loading && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 text-indigo-400">
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">AI Team Analyst <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full ml-2">Beta</span></h3>
                        <p className="text-slate-400 text-sm max-w-md mb-6">
                            Unlock an instant, <span className="text-indigo-400 font-bold">AI-Powered</span> executive summary of your dynasty team. Get objective grading, strategic direction, and actionable trade advice.
                        </p>
                        <Button
                            onClick={handleAnalyze}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20"
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Analyze My Team
                        </Button>
                        {error && (
                            <div className="mt-4 p-3 bg-red-900/30 border border-red-800/50 rounded text-red-200 text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-10">
                        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-white animate-pulse">Scouting your league...</h3>
                        <p className="text-slate-500 text-xs mt-2">Analyzing roster value, market trends, and league settings.</p>
                    </div>
                )}

                {report && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
                                    {report.team_grade}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Team Grade</span>
                                    <span className="text-slate-300 text-sm">{report.team_grade_explanation}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Direction</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${report.direction === 'Contender'
                                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                    : report.direction === 'Rebuilder'
                                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                                        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                    }`}>
                                    {report.direction}
                                </span>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="mb-8">
                            <h4 className="text-sm font-bold text-slate-300 mb-2">Executive Summary</h4>
                            <p className="text-slate-400 text-sm leading-relaxed bg-slate-800/50 p-4 rounded border border-slate-700/50">
                                {report.summary}
                            </p>
                        </div>

                        {/* Strengths & Weaknesses */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <div className="bg-green-900/10 border border-green-500/20 rounded p-4">
                                <h5 className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase mb-3">
                                    <TrendingUp className="w-4 h-4" /> Top Strengths
                                </h5>
                                <ul className="space-y-2">
                                    {report.top_strengths?.map((s, i) => (
                                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-red-900/10 border border-red-500/20 rounded p-4">
                                <h5 className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase mb-3">
                                    <TrendingDown className="w-4 h-4" /> core Weaknesses
                                </h5>
                                <ul className="space-y-2">
                                    {report.top_weaknesses?.map((w, i) => (
                                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Action Items */}
                        <div>
                            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-400" /> Action Plan
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {report.action_items?.map((item, i) => (
                                    <div key={i} className="bg-slate-800/80 p-4 rounded border border-slate-700 hover:border-indigo-500/30 transition-colors">
                                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-2 border-b border-slate-700 pb-1">
                                            {item.type}
                                        </div>
                                        <div className="font-bold text-indigo-300 text-sm mb-2">{item.title}</div>
                                        <p className="text-xs text-slate-400 leading-normal">
                                            {item.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <Button variant="ghost" size="sm" onClick={() => setReport(null)} className="text-slate-500 text-xs hover:text-white">
                                Run New Analysis
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TeamAnalyzer;
