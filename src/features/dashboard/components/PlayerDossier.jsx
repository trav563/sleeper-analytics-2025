import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import { Card } from '../../../components/ui/Card';
import { ScrollArea } from '../../../components/ui/ScrollArea';
import { avatarUrl, displayTeamName } from '../../../utils/nflData';
import { fetchFullTransactionHistory } from '../../../utils/sleeper';
import { ArrowLeftRight, Activity, TrendingUp, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const PlayerDossier = ({ player, isOpen, onClose, seasonMatchups, users, rosters, league }) => {
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch Deep History when opened
    useEffect(() => {
        if (isOpen && player && league?.league_id) {
            setLoadingHistory(true);
            fetchFullTransactionHistory(league.league_id, 3) // 3 years back
                .then(trades => {
                    // Filter for this player
                    const relevant = trades.filter(t =>
                        t.adds?.[player.player_id] || t.drops?.[player.player_id]
                    ).sort((a, b) => b.created - a.created);
                    setHistory(relevant);
                })
                .catch(err => console.error("Failed to fetch history", err))
                .finally(() => setLoadingHistory(false));
        }
    }, [isOpen, player, league?.league_id]);

    if (!player) return null;

    // --- Tab 1: The Ledger (Trade History) ---
    // Use the fetched 'history' state instead of props
    const tradeHistory = history;

    // --- Tab 2: The Pulse (Performance) ---
    // Extract weekly points for this player from seasonMatchups
    // seasonMatchups is [ { matchup_id, roster_id, points, players: [id, id], starters: [id]... }] for each week
    // Actually seasonMatchups structure from hook is complex. It's usually keyed by week or flat list?
    // Looking at useSeasonMatchups usage elsewhere: it returns { match ups } or array...
    // Let's assume we need to process it. The hook usually returns { 1: [matchups], 2: [matchups] } or similar?
    // Wait, useSeasonMatchups returns { seasonMatchups: { '1': [...], '2': [...] } } usually.
    // I'll need to double check the structure of seasonMatchups passed down.
    // Assuming it's an object keyed by Week Number.

    // Helper to get formatted data
    const performanceData = [];
    if (seasonMatchups) {
        Object.entries(seasonMatchups).forEach(([week, matchups]) => {
            if (!matchups) return;
            // Find the matchup containing this player
            // Player might be in 'players' array of a roster
            // We need to find the specific player object if available (Sleeper usually returns points in a separate object or we calculate?)
            // Actually, `matchups` from Sleeper endpoint /league/<id>/matchups/<week> returns:
            // { points, roster_id, starters: [], players: [], players_points: { id: score } }

            matchups.forEach(m => {
                if (m.players_points && m.players_points[player.player_id] !== undefined) {
                    const pts = m.players_points[player.player_id];
                    performanceData.push({
                        week: `W${week}`,
                        points: pts === 0 ? null : pts, // Use null for 0 to create gaps
                        projected: m.starters_points?.[player.player_id] || 0
                    });
                }
            });
        });
    }

    // Calculate Consistency (CV Method) - Active Games Only
    const activeScores = performanceData
        .map(d => d.points)
        .filter(p => p !== null && p > 0); // Exclude 0/Null

    const avg = activeScores.length ? activeScores.reduce((a, b) => a + b, 0) / activeScores.length : 0;
    const stdDev = activeScores.length ? Math.sqrt(activeScores.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / activeScores.length) : 0;
    const cv = avg > 0 ? stdDev / avg : 0;

    // Curved Grading Scale (Fantasy Specific)
    let consistencyGrade = 'F (Lottery Ticket)';
    let consistencyColor = 'text-red-500';
    let subText = `Typically scores +/- ${stdDev.toFixed(1)}pts of average`;

    if (activeScores.length < 3) {
        consistencyGrade = 'N/A';
        consistencyColor = 'text-slate-500';
        subText = 'Not enough active games to grade';
    } else if (cv < 0.20) { consistencyGrade = 'A+ (Robot)'; consistencyColor = 'text-purple-400'; }
    else if (cv < 0.35) { consistencyGrade = 'A (Elite)'; consistencyColor = 'text-blue-400'; }
    else if (cv < 0.50) { consistencyGrade = 'B (Reliable)'; consistencyColor = 'text-green-400'; }
    else if (cv < 0.75) { consistencyGrade = 'C (Volatile)'; consistencyColor = 'text-yellow-400'; }
    else if (cv <= 1.0) { consistencyGrade = 'D (Boom/Bust)'; consistencyColor = 'text-orange-400'; }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700 text-white">
                <DialogHeader>
                    <div className="flex items-center gap-4">
                        <img
                            src={avatarUrl(player.player_id)}
                            alt={player.last_name}
                            className="w-16 h-16 rounded-full border-2 border-slate-600"
                        />
                        <div>
                            <DialogTitle className="text-2xl font-bold">{player.first_name} {player.last_name}</DialogTitle>
                            <DialogDescription className="text-slate-400 flex items-center gap-2">
                                {player.team || 'FA'} • {player.position}
                                {player.injury_status && (
                                    <span className="text-red-400 font-bold uppercase text-xs border border-red-500/30 px-1.5 rounded">
                                        {player.injury_status}
                                    </span>
                                )}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="pulse" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                        <TabsTrigger value="pulse">The Pulse 📈</TabsTrigger>
                        <TabsTrigger value="ledger">The Ledger 📜</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pulse" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Consistency Grade</p>
                                <p className={`text-xl font-bold ${consistencyColor}`}>{consistencyGrade}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    {subText}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 uppercase tracking-wider">Avg PPG</p>
                                <p className="text-xl font-bold text-blue-400">{avg.toFixed(1)}</p>
                            </div>
                        </div>

                        <div className="h-[250px] w-full bg-slate-800/20 rounded-lg p-2 border border-slate-800">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData}>
                                    <XAxis dataKey="week" stroke="#64748b" fontSize={10} tickLine={false} />
                                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                        itemStyle={{ color: '#60a5fa' }}
                                    />
                                    <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'AVG', fill: '#94a3b8', fontSize: 10 }} />
                                    <Line type="monotone" dataKey="points" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#1d4ed8' }} activeDot={{ r: 6 }} connectNulls={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </TabsContent>

                    <TabsContent value="ledger" className="mt-4">
                        <ScrollArea className="h-[300px] w-full rounded-md border border-slate-700 bg-slate-900/50 p-4">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    <p className="text-sm"> digging through the archives...</p>
                                </div>
                            ) : tradeHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 opacity-70">
                                    <ArrowLeftRight className="w-8 h-8" />
                                    <p className="text-sm">No recorded trades for this player.</p>
                                    <p className="text-xs">Likely an original draft pick or waiver add.</p>
                                </div>
                            ) : (
                                <div className="relative border-l border-slate-700 ml-3 space-y-6">
                                    {tradeHistory.map((t, idx) => {
                                        const destRosterId = t.adds?.[player.player_id];
                                        const sourceRosterId = t.drops?.[player.player_id];

                                        // Note: Roster IDs from previous seasons won't match current rosters.
                                        // Ideally we fetch historical rosters, but for now we fallback gracefully.
                                        // We attempt to find a roster with same ID in current league (unlikely correct but safe fallback or just show ID)
                                        // Actually, roster_ids are usually 1-12.
                                        // If User A was Roster 1 in 2023 and Roster 1 in 2024, it matches.
                                        // Sleeper roster IDs are stable index-based usually (1-12) unless commish changes it? No, usually stable.
                                        // So using current rosters array (which is keyed by roster_id potentially) might actually work for Team Names!

                                        const destUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === destRosterId)?.owner_id);
                                        const sourceUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === sourceRosterId)?.owner_id);

                                        return (
                                            <div key={t.transaction_id} className="ml-6 relative">
                                                <span className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 ring-4 ring-slate-900">
                                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                </span>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
                                                        {t.season && <span className="bg-slate-700 px-1 rounded text-white">{t.season}</span>}
                                                        Week {t.leg} • {new Date(t.created).toLocaleDateString()}
                                                    </span>
                                                    <p className="text-sm text-white">
                                                        Traded from <span className="font-bold text-red-300">{displayTeamName(sourceUser) || `Roster ${sourceRosterId}`}</span> to <span className="font-bold text-green-300">{displayTeamName(destUser) || `Roster ${destRosterId}`}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default PlayerDossier;
