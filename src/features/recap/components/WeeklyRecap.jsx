import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Trophy, AlertTriangle, TrendingUp, Share2, Download, Copy, Dumbbell, Percent, Shuffle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useWeeklyRecap } from '../hooks/useWeeklyRecap';
import { fetchLeagueMatchups } from '../../../utils/sleeper';
import { toPng } from 'html-to-image';
import QRCode from 'react-qr-code';

const WeeklyRecap = ({ league, rosters, users, players, currentWeek }) => {
    const [recapWeek, setRecapWeek] = useState(null);
    const [matchups, setMatchups] = useState([]);
    const [loading, setLoading] = useState(true);
    const captureRef = useRef(null);

    useEffect(() => {
        if (!league?.league_id || !currentWeek) return;

        // Target previous week, but ensure we don't go below 1
        const target = currentWeek > 1 ? currentWeek - 1 : 1;
        setRecapWeek(target);

        const load = async () => {
            setLoading(true);
            try {
                // If currentWeek is 1, we normally wouldn't have a recap unless we want to show Week 1 *after* it's done.
                // Assuming this component is viewed during the season.
                // If currentWeek (display_week) is 1, the season just started, no previous week.
                // We'll fetch 'target' week anyway.
                const data = await fetchLeagueMatchups(league.league_id, target);
                setMatchups(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [league, currentWeek]);

    const stats = useWeeklyRecap(league, matchups, rosters, users, players, recapWeek);

    const copyToClipboard = () => {
        if (!stats) return;
        let text = `🔥 Week ${recapWeek} Roast 🔥\n\n`;

        if (stats.robbery) text += `🤡 The Robbery:\n${stats.robbery.manager} scored ${stats.robbery.score} (would have beaten ${stats.robbery.percentile}% of league) but lost to ${stats.robbery.opponent}.\n\n`;
        if (stats.worstManager) text += `📉 Manager Malpractice:\n${stats.worstManager.manager} left ${stats.worstManager.benchPoints} pts (${stats.worstManager.benchPlayer.first_name}) on the bench.\n\n`;
        if (stats.topRookie) text += `👶 The Dynasty Flex:\n${stats.topRookie.player.first_name} ${stats.topRookie.player.last_name} (${stats.topRookie.points} pts) managed by ${stats.topRookie.manager}.\n\n`;
        if (stats.bagCarrier) text += `🎒 The Backpack:\n${stats.bagCarrier.player.last_name} carried ${stats.bagCarrier.manager} by scoring ${stats.bagCarrier.percentage}% of the team's points.\n\n`;
        if (stats.coinFlipFail) text += `🪙 Coin Flip Fail:\n${stats.coinFlipFail.manager} started ${stats.coinFlipFail.starter.last_name} (${stats.coinFlipFail.starterPoints}) over ${stats.coinFlipFail.bench.last_name} (${stats.coinFlipFail.benchPoints}). Ouch.\n\n`;
        if (stats.cardioKing) text += `💤 Cardio Kings:\n${stats.cardioKing.manager} had ${stats.cardioKing.count} starters score under 5 points. Doing cardio.\n`;

        const leagueUrl = `${window.location.origin}/league/${league.league_id}`;
        text += `\nAnalyzed by Dynasty Lens\n${leagueUrl}`;
        navigator.clipboard.writeText(text);
        alert("Recap copied to clipboard!");
    };

    const downloadImage = async () => {
        if (captureRef.current) {
            try {
                const dataUrl = await toPng(captureRef.current, { cacheBust: true, backgroundColor: '#0f172a' });
                const link = document.createElement('a');
                link.download = `week-${recapWeek}-roast.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Failed to generate image', err);
            }
        }
    };

    if (loading) return <div className="text-center p-10 text-muted-foreground animate-pulse">Brewing the roast...</div>;
    // Basic check if data exists
    if (!stats || (!stats.robbery && !stats.worstManager)) return <div className="text-center p-10 text-muted-foreground">No data available for Week {recapWeek}.</div>;

    const leagueUrl = `${window.location.origin}/league/${league.league_id}`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">The Roast</h2>
                    <p className="text-muted-foreground">Weekly Recap for Week {recapWeek}</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={copyToClipboard} variant="outline" className="gap-2">
                        <Copy className="w-4 h-4" /> Copy Text
                    </Button>
                    <Button onClick={downloadImage} className="gap-2">
                        <Download className="w-4 h-4" /> Save Image
                    </Button>
                </div>
            </div>

            {/* Capture Area */}
            <div ref={captureRef} className="p-8 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 p-10 opacity-5">
                    <Trophy className="w-64 h-64" />
                </div>

                <div className="mb-8 relative z-10">
                    <h3 className="text-2xl font-bold text-white mb-1">{league.name}</h3>
                    <p className="text-orange-500 font-bold uppercase tracking-widest text-sm">Week {recapWeek} Recap</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                    {/* 1. The Robbery */}
                    {stats.robbery && (
                        <Card className="border-red-900/50 bg-red-950/20 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-red-500 mb-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    <span className="font-bold uppercase tracking-wider text-xs">The Robbery</span>
                                </div>
                                <CardTitle className="text-xl md:text-2xl">{stats.robbery.manager}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-300 text-sm md:text-base">
                                    Scored <span className="font-bold text-white">{stats.robbery.score}</span> points (would beat <span className="font-bold text-red-400">{stats.robbery.percentile}%</span>) yet lost to {stats.robbery.opponent}. Call the cops.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* 2. Manager Malpractice */}
                    {stats.worstManager && (
                        <Card className="border-orange-900/50 bg-orange-950/20 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-orange-500 mb-2">
                                    <TrendingUp className="w-5 h-5" />
                                    <span className="font-bold uppercase tracking-wider text-xs">Manager Malpractice</span>
                                </div>
                                <CardTitle className="text-xl md:text-2xl">{stats.worstManager.manager}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-300 text-sm md:text-base">
                                    Left <span className="font-bold text-white">{stats.worstManager.benchPoints}</span> points on the bench from <span className="text-orange-300 font-medium">{stats.worstManager.benchPlayer.first_name} {stats.worstManager.benchPlayer.last_name}</span>.
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">Efficiency Rating: <span className="text-red-400">Low</span></p>
                            </CardContent>
                        </Card>
                    )}

                    {/* 3. The Dynasty Flex */}
                    {stats.topRookie && (
                        <Card className="border-green-900/50 bg-green-950/20 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-green-500 mb-2">
                                    <Trophy className="w-5 h-5" />
                                    <span className="font-bold uppercase tracking-wider text-xs">The Dynasty Flex</span>
                                </div>
                                <CardTitle className="text-xl md:text-2xl">Rookie of the Week</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-800 border border-green-500/30 shrink-0">
                                        <img
                                            src={`https://sleepercdn.com/content/nfl/players/${stats.topRookie.player.player_id}.jpg`}
                                            alt={stats.topRookie.player.last_name}
                                            className="h-full w-full object-cover"
                                            onError={(e) => e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'}
                                        />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm">{stats.topRookie.player.first_name} {stats.topRookie.player.last_name}</div>
                                        <div className="text-green-400 font-mono font-bold text-sm">{stats.topRookie.points} pts</div>
                                        <div className="text-xs text-muted-foreground">Mgr: {stats.topRookie.manager}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 4. The Backpack Award */}
                    {stats.bagCarrier && (
                        <Card className="border-blue-900/50 bg-blue-950/20 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-blue-500 mb-2">
                                    <Dumbbell className="w-5 h-5" />
                                    <span className="font-bold uppercase tracking-wider text-xs">The Backpack Award</span>
                                </div>
                                <CardTitle className="text-xl md:text-2xl">{stats.bagCarrier.manager}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-300 text-sm md:text-base">
                                    Carried by <span className="font-bold text-white">{stats.bagCarrier.player.first_name} {stats.bagCarrier.player.last_name}</span> working overtime.
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Accounted for <span className="text-blue-400 font-bold">{stats.bagCarrier.percentage}%</span> of total team score.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* 5. The Coin Flip Fail */}
                    {stats.coinFlipFail && (
                        <Card className="border-yellow-900/50 bg-yellow-950/20 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-yellow-500 mb-2">
                                    <Shuffle className="w-5 h-5" />
                                    <span className="font-bold uppercase tracking-wider text-xs">The Coin Flip Fail</span>
                                </div>
                                <CardTitle className="text-xl md:text-2xl">{stats.coinFlipFail.manager}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-300 text-sm md:text-base">
                                    Started <span className="text-red-400">{stats.coinFlipFail.starter.last_name} ({stats.coinFlipFail.starterPoints})</span> over <span className="text-green-400">{stats.coinFlipFail.bench.last_name} ({stats.coinFlipFail.benchPoints})</span>.
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground italic">Trust issues loading...</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* 6. The Cardio Kings */}
                    {stats.cardioKing && (
                        <Card className="border-gray-700 bg-gray-900/40 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-gray-400 mb-2">
                                    <Percent className="w-5 h-5" />
                                    <span className="font-bold uppercase tracking-wider text-xs">The Cardio Kings</span>
                                </div>
                                <CardTitle className="text-xl md:text-2xl">{stats.cardioKing.manager}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-300 text-sm md:text-base">
                                    Had <span className="font-bold text-white">{stats.cardioKing.count}</span> starters score under 5 points.
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">True team effort in doing absolutely nothing.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Viral Footer */}
                <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between relative z-10">
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Generated by</p>
                        <p className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Dynasty Lens</p>
                        <p className="text-xs text-slate-500 mt-1">Find your league's roast at dynasty-lens.vercel.app</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                        <QRCode
                            size={64}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            value={leagueUrl}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeeklyRecap;
