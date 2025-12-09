import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import { Card } from '../../../components/ui/Card';
import { ScrollArea } from '../../../components/ui/ScrollArea';
import { avatarUrl, displayTeamName } from '../../../utils/nflData';
import { ArrowLeftRight, Activity, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const PlayerDossier = ({ player, isOpen, onClose, transactions, seasonMatchups, users, rosters }) => {
    if (!player) return null;

    // --- Tab 1: The Ledger (Trade History) ---
    const tradeHistory = (transactions || []).filter(t =>
        t.type === 'trade' && t.adds && t.adds[player.player_id]
    ).sort((a, b) => b.created - a.created);

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
                    performanceData.push({
                        week: `W${week}`,
                        points: m.players_points[player.player_id],
                        projected: m.starters_points?.[player.player_id] || 0 // Sleeper might not give historical projections easily here without deeper dive, we'll strip projected for now if unavailable
                    });
                }
            });
        });
    }

    // Calculate Consistency
    const scores = performanceData.map(d => d.points);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const stdDev = scores.length ? Math.sqrt(scores.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / scores.length) : 0;
    const cv = avg > 0 ? (stdDev / avg) * 100 : 0;
    const consistencyGrade = cv < 20 ? 'A (Elite)' : cv < 40 ? 'B (Reliable)' : cv < 60 ? 'C (Volatile)' : 'D (Boom/Bust)';
    const consistencyColor = cv < 30 ? 'text-green-400' : cv < 50 ? 'text-yellow-400' : 'text-red-400';

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
                                <p className="text-xs text-slate-400 uppercase tracking-wider">Consistency Grade</p>
                                <p className={`text-xl font-bold ${consistencyColor}`}>{consistencyGrade}</p>
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
                                    <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="3 3" />
                                    <Line type="monotone" dataKey="points" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#1d4ed8' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </TabsContent>

                    <TabsContent value="ledger" className="mt-4">
                        <ScrollArea className="h-[300px] w-full rounded-md border border-slate-700 bg-slate-900/50 p-4">
                            {tradeHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 opacity-70">
                                    <ArrowLeftRight className="w-8 h-8" />
                                    <p className="text-sm">No recorded trades for this player.</p>
                                    <p className="text-xs">Likely an original draft pick or waiver add.</p>
                                </div>
                            ) : (
                                <div className="relative border-l border-slate-700 ml-3 space-y-6">
                                    {tradeHistory.map((t, idx) => {
                                        // Identify From and To
                                        // "adds" contains the player. KEY is player_id, VALUE is roster_id (DESTINATION)
                                        // "drops" usually contains the SOURCE? Or we have to look transaction structure.
                                        // In Sleeper trade: 
                                        // adds: { player_id: roster_id_destination }
                                        // drops: { player_id: roster_id_source } (sometimes null if only adds?)
                                        // Actually for TRADES, `drops` shows who gave it up.

                                        const destRosterId = t.adds[player.player_id];
                                        const sourceRosterId = t.drops?.[player.player_id];

                                        const destUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === destRosterId)?.owner_id);
                                        const sourceUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === sourceRosterId)?.owner_id);

                                        return (
                                            <div key={t.transaction_id} className="ml-6 relative">
                                                <span className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 ring-4 ring-slate-900">
                                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                </span>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-slate-500 font-mono">
                                                        Week {t.leg} • {new Date(t.created).toLocaleDateString()}
                                                    </span>
                                                    <p className="text-sm text-white">
                                                        Traded from <span className="font-bold text-red-300">{displayTeamName(sourceUser)}</span> to <span className="font-bold text-green-300">{displayTeamName(destUser)}</span>
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
