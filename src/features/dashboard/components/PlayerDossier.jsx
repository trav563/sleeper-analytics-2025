import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/Dialog';
import { ScrollArea } from '../../../components/ui/ScrollArea';
import { playerHeadshotUrl, displayTeamName } from '../../../utils/nflData';
import { fetchFullTransactionHistory } from '../../../utils/sleeper';
import { ArrowLeftRight, Activity, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { theme } from '../../../lib/theme';

const PlayerDossier = ({ player, isOpen, onClose, seasonMatchups, users, rosters, league }) => {
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [tab, setTab] = useState('pulse');

    useEffect(() => {
        if (isOpen && player && league?.league_id) {
            setLoadingHistory(true);
            fetchFullTransactionHistory(league.league_id, 3)
                .then(trades => {
                    const relevant = trades.filter(t =>
                        t.adds?.[player.player_id] || t.drops?.[player.player_id]
                    ).sort((a, b) => b.created - a.created);
                    setHistory(relevant);
                })
                .catch(err => console.error('Failed to fetch history', err))
                .finally(() => setLoadingHistory(false));
        }
    }, [isOpen, player, league?.league_id]);

    if (!player) return null;

    const tradeHistory = history;

    const performanceData = [];
    if (seasonMatchups) {
        Object.entries(seasonMatchups).forEach(([week, matchups]) => {
            if (!matchups) return;
            matchups.forEach(m => {
                if (m.players_points && m.players_points[player.player_id] !== undefined) {
                    const pts = m.players_points[player.player_id];
                    performanceData.push({
                        week: `W${week}`,
                        points: pts === 0 ? null : pts,
                        projected: m.starters_points?.[player.player_id] || 0,
                    });
                }
            });
        });
    }

    const activeScores = performanceData
        .map(d => d.points)
        .filter(p => p !== null && p > 0);

    const avg = activeScores.length ? activeScores.reduce((a, b) => a + b, 0) / activeScores.length : 0;
    const stdDev = activeScores.length ? Math.sqrt(activeScores.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / activeScores.length) : 0;
    const cv = avg > 0 ? stdDev / avg : 0;

    let consistencyGrade = 'F · Lottery Ticket';
    let consistencyColor = 'text-bad';
    let subText = `Typically scores ±${stdDev.toFixed(1)}pts of average`;

    if (activeScores.length < 3) {
        consistencyGrade = 'N/A';
        consistencyColor = 'text-text-mute';
        subText = 'Not enough active games to grade';
    } else if (cv < 0.20) { consistencyGrade = 'A+ · Robot';     consistencyColor = 'text-signal-2'; }
    else if (cv < 0.35)  { consistencyGrade = 'A · Elite';      consistencyColor = 'text-signal'; }
    else if (cv < 0.50)  { consistencyGrade = 'B · Reliable';   consistencyColor = 'text-good'; }
    else if (cv < 0.75)  { consistencyGrade = 'C · Volatile';   consistencyColor = 'text-warn'; }
    else if (cv <= 1.0)  { consistencyGrade = 'D · Boom/Bust';  consistencyColor = 'text-signal-2'; }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] bg-bg-1 border border-line shadow-pop text-text">
                <DialogHeader>
                    <div className="flex items-center gap-4">
                        <img
                            src={playerHeadshotUrl(player.player_id)}
                            alt={player.last_name}
                            className="w-16 h-16 rounded-full ring-1 ring-line object-cover"
                            onError={(e) => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
                        />
                        <div className="min-w-0">
                            <DialogTitle className="font-display text-2xl font-bold text-text truncate">
                                {player.first_name} {player.last_name}
                            </DialogTitle>
                            <DialogDescription className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-2 mt-1">
                                <span>{player.team || 'FA'} · {player.position}</span>
                                {player.injury_status && (
                                    <span className="text-bad font-bold border border-bad/30 bg-bad/10 px-1.5 py-0.5 rounded-sm">
                                        {player.injury_status}
                                    </span>
                                )}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <SegmentedTabs
                    tabs={[
                        { value: 'pulse', label: 'The Pulse' },
                        { value: 'ledger', label: 'The Ledger' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />

                {tab === 'pulse' ? (
                    <div className="space-y-4 mt-2">
                        {performanceData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-text-mute space-y-2">
                                <Activity className="w-7 h-7" />
                                <p className="text-sm font-semibold text-text">No scoring data available</p>
                                <p className="text-xs text-center max-w-xs">Season hasn't started yet. Performance stats will appear once games are played.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center bg-bg-2 p-3 rounded-md border border-line">
                                    <div>
                                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-1">Consistency Grade</p>
                                        <p className={`font-display text-xl font-bold ${consistencyColor}`}>{consistencyGrade}</p>
                                        <p className="font-mono text-2xs text-text-mute mt-0.5">{subText}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">Avg PPG</p>
                                        <p className="font-display text-xl font-bold text-signal tnum">{avg.toFixed(1)}</p>
                                    </div>
                                </div>

                                <div className="h-[250px] w-full bg-bg-2 rounded-md p-2 border border-line">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={performanceData}>
                                            <XAxis dataKey="week" stroke={theme.color.textMute} fontSize={10} tickLine={false} tick={{ fontFamily: 'var(--font-mono)' }} />
                                            <YAxis stroke={theme.color.textMute} fontSize={10} tickLine={false} tick={{ fontFamily: 'var(--font-mono)' }} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: theme.color.bg1,
                                                    border: `1px solid ${theme.color.lineStrong}`,
                                                    borderRadius: theme.radius.md,
                                                    color: theme.color.text,
                                                    fontFamily: 'var(--font-sans)',
                                                    fontSize: 12,
                                                }}
                                                itemStyle={{ color: theme.color.signal }}
                                            />
                                            <ReferenceLine
                                                y={avg}
                                                stroke={theme.color.textDim}
                                                strokeDasharray="3 3"
                                                label={{ value: 'AVG', fill: theme.color.textDim, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                                            />
                                            <Line type="monotone" dataKey="points" stroke={theme.color.signal} strokeWidth={2.5} dot={{ r: 4, fill: theme.color.signal }} activeDot={{ r: 6 }} connectNulls={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <ScrollArea className="h-[300px] w-full rounded-md border border-line bg-bg p-4 mt-2">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-mute space-y-2">
                                <Loader2 className="w-7 h-7 animate-spin text-signal" />
                                <p className="text-sm">Digging through the archives…</p>
                            </div>
                        ) : tradeHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-mute space-y-2">
                                <ArrowLeftRight className="w-7 h-7 opacity-60" />
                                <p className="text-sm">No recorded trades for this player.</p>
                                <p className="font-mono text-2xs uppercase tracking-wider">Likely an original draft pick or waiver add.</p>
                            </div>
                        ) : (
                            <div className="relative border-l border-line ml-3 space-y-5">
                                {tradeHistory.map((t) => {
                                    const destRosterId = t.adds?.[player.player_id];
                                    const sourceRosterId = t.drops?.[player.player_id];

                                    const destUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === destRosterId)?.owner_id);
                                    const sourceUser = users.find(u => u.user_id === rosters.find(r => r.roster_id === sourceRosterId)?.owner_id);

                                    return (
                                        <div key={t.transaction_id} className="ml-6 relative">
                                            <span className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-bg-2 ring-4 ring-bg">
                                                <div className="h-2 w-2 rounded-full bg-signal" />
                                            </span>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-2">
                                                    {t.season && <span className="bg-bg-3 border border-line px-1.5 py-0.5 rounded-sm tnum text-text-dim">{t.season}</span>}
                                                    Week <span className="tnum">{t.leg}</span> · <span className="tnum">{new Date(t.created).toLocaleDateString()}</span>
                                                </span>
                                                <p className="text-sm text-text-dim">
                                                    Traded from <span className="font-semibold text-signal-2">{displayTeamName(sourceUser) || `Roster ${sourceRosterId}`}</span>{' '}
                                                    to <span className="font-semibold text-good">{displayTeamName(destUser) || `Roster ${destRosterId}`}</span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PlayerDossier;
