import { useState, useEffect, useRef, useMemo } from 'react';
import { Trophy, AlertTriangle, TrendingUp, TrendingDown, Download, Copy, Dumbbell, Percent, Shuffle, Sparkles, Timer, Ghost, Flame } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useWeeklyRecap } from '../hooks/useWeeklyRecap';
import { fetchLeagueMatchups } from '../../../utils/sleeper';
import { WEEKLY_COPY, getSeededCopy, fillTemplate } from '../data/roastCopy';
import { toPng } from 'html-to-image';
import QRCode from 'react-qr-code';
import SeasonSuperlativesView from './SeasonSuperlativesView';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { theme } from '../../../lib/theme';

const TONE = {
    bad:      { border: 'border-bad/40',      bg: 'bg-bad/10',      text: 'text-bad' },
    warn:     { border: 'border-warn/40',     bg: 'bg-warn/10',     text: 'text-warn' },
    signal:   { border: 'border-signal/40',   bg: 'bg-signal/10',   text: 'text-signal' },
    signal2:  { border: 'border-signal-2/40', bg: 'bg-signal-2/10', text: 'text-signal-2' },
    good:     { border: 'border-good/40',     bg: 'bg-good/10',     text: 'text-good' },
    neutral:  { border: 'border-line',        bg: 'bg-bg-2/50',     text: 'text-text-dim' },
};

const RoastCard = ({ tone = 'neutral', icon: Icon, title, manager, children }) => {
    const t = TONE[tone] || TONE.neutral;
    return (
        <section className={`rounded-xl border ${t.border} ${t.bg} backdrop-blur-sm shadow-card`}>
            <header className="px-4 pt-4 pb-2">
                <div className={`flex items-center gap-2 ${t.text} mb-2`}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span className="font-mono text-2xs uppercase tracking-wider font-bold">{title}</span>
                </div>
                <h3 className="font-display text-lg md:text-xl font-bold text-text">{manager}</h3>
            </header>
            <div className="px-4 pb-4">{children}</div>
        </section>
    );
};

const PlayerHeadshot = ({ playerId, lastName, ringTone = 'border-line' }) => (
    <div className={`h-10 w-10 rounded-full overflow-hidden bg-bg-3 border ${ringTone} shrink-0`}>
        <img
            src={`https://sleepercdn.com/content/nfl/players/${playerId}.jpg`}
            alt={lastName}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
        />
    </div>
);

const WeeklyRecap = ({ league, rosters, users, players, currentWeek, seasonMatchups, seasonMatchupsLoading }) => {
    const [tab, setTab] = useState('weekly');
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [matchups, setMatchups] = useState([]);
    const [loading, setLoading] = useState(true);
    const captureRef = useRef(null);

    useEffect(() => {
        if (!currentWeek) return;
        const target = currentWeek > 1 ? currentWeek - 1 : 1;
        setSelectedWeek(target);
    }, [currentWeek]);

    useEffect(() => {
        if (!league?.league_id || !selectedWeek) {
            setLoading(false);
            return;
        }
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchLeagueMatchups(league.league_id, selectedWeek);
                setMatchups(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [league, selectedWeek]);

    const stats = useWeeklyRecap(league, matchups, rosters, users, players, selectedWeek, seasonMatchups);

    const roastCopy = useMemo(() => {
        if (!stats || !league?.league_id || !selectedWeek) return {};
        const seed = `${league.league_id}-${selectedWeek}`;
        const picks = {};
        Object.keys(WEEKLY_COPY).forEach(key => {
            picks[key] = getSeededCopy(WEEKLY_COPY, key, seed);
        });
        return picks;
    }, [stats, league?.league_id, selectedWeek]);

    const availableWeeks = useMemo(() => {
        if (!currentWeek || currentWeek < 1) return [];
        const weeks = [];
        const max = currentWeek > 1 ? currentWeek - 1 : 1;
        for (let w = max; w >= 1; w--) weeks.push(w);
        return weeks;
    }, [currentWeek]);

    const getCardData = (category) => {
        const s = stats?.[category];
        if (!s) return {};
        switch (category) {
            case 'robbery': return { ...s };
            case 'worstManager': return { ...s, benchPlayer: `${s.benchPlayer.first_name} ${s.benchPlayer.last_name}`, diff: s.diff };
            case 'topRookie': return { ...s, playerName: `${s.player.first_name} ${s.player.last_name}`, points: s.points };
            case 'bagCarrier': return { ...s, playerName: `${s.player.first_name} ${s.player.last_name}` };
            case 'coinFlipFail': return { ...s, starter: s.starter.last_name, bench: s.bench.last_name };
            case 'cardioKing': return { ...s };
            case 'tankCommander': return { ...s };
            case 'luckyCharm': return { ...s };
            case 'closeCall': return { ...s };
            case 'ghost': return { ...s, ghostNames: s.players.map(p => p.last_name).join(', ') };
            case 'boomGame': return { ...s, playerName: `${s.player.first_name} ${s.player.last_name}`, points: s.points };
            case 'overachiever': return { ...s };
            case 'underachiever': return { ...s };
            default: return {};
        }
    };

    const copyToClipboard = () => {
        if (!stats) return;
        let text = `Week ${selectedWeek} Roast — ${league.name}\n\n`;
        const add = (label, category, data) => {
            if (!data) return;
            const copy = roastCopy[category];
            if (copy) text += `${label}:\n${data.manager || data.winner || ''} — ${fillTemplate(copy.text, data)}\n\n`;
        };
        if (stats.robbery) add('The Robbery', 'robbery', { ...stats.robbery });
        if (stats.worstManager) add('Manager Malpractice', 'worstManager', { ...stats.worstManager, benchPlayer: `${stats.worstManager.benchPlayer.first_name} ${stats.worstManager.benchPlayer.last_name}` });
        if (stats.boomGame) add('Boom Game', 'boomGame', { ...stats.boomGame, playerName: `${stats.boomGame.player.first_name} ${stats.boomGame.player.last_name}` });
        if (stats.bagCarrier) add('The Backpack', 'bagCarrier', { ...stats.bagCarrier, playerName: `${stats.bagCarrier.player.first_name} ${stats.bagCarrier.player.last_name}` });
        if (stats.tankCommander) add('Tank Commander', 'tankCommander', { ...stats.tankCommander });
        if (stats.luckyCharm) add('Lucky Charm', 'luckyCharm', { ...stats.luckyCharm });
        if (stats.closeCall) add('Close Call', 'closeCall', { ...stats.closeCall });
        if (stats.coinFlipFail) add('Coin Flip Fail', 'coinFlipFail', { ...stats.coinFlipFail, starter: stats.coinFlipFail.starter.last_name, bench: stats.coinFlipFail.bench.last_name });
        if (stats.ghost) add('The Ghost', 'ghost', { ...stats.ghost, ghostNames: stats.ghost.players.map(p => p.last_name).join(', ') });
        if (stats.topRookie) add('Dynasty Flex', 'topRookie', { ...stats.topRookie, playerName: `${stats.topRookie.player.first_name} ${stats.topRookie.player.last_name}` });
        if (stats.cardioKing) add('Cardio Kings', 'cardioKing', { ...stats.cardioKing });

        const leagueUrl = `${window.location.origin}/league/${league.league_id}`;
        text += `\nGenerated by League Analysis\n${leagueUrl}`;
        navigator.clipboard.writeText(text);
        alert('Roast copied to clipboard!');
    };

    const downloadImage = async () => {
        if (captureRef.current) {
            try {
                const dataUrl = await toPng(captureRef.current, { cacheBust: true, backgroundColor: theme.color.bg });
                const link = document.createElement('a');
                link.download = `week-${selectedWeek}-roast.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Failed to generate image', err);
            }
        }
    };

    const leagueUrl = league ? `${window.location.origin}/league/${league.league_id}` : '';
    const hasWeeklyData = stats && (stats.robbery || stats.worstManager || stats.tankCommander || stats.boomGame);

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <Flame className="w-3 h-3 text-signal-2" aria-hidden="true" />
                        The Roast
                    </div>
                    <h2
                        className="mt-1 font-display text-3xl font-bold tracking-snug"
                        style={{
                            background: 'linear-gradient(90deg, var(--signal), var(--signal-2))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        Weekly &amp; Seasonal Roasts
                    </h2>
                    <p className="text-sm text-text-dim mt-0.5">Awards, malpractice, and superlatives</p>
                </div>
            </header>

            <SegmentedTabs
                tabs={[
                    { value: 'weekly', label: 'Weekly Roast' },
                    { value: 'season', label: 'Season Superlatives' },
                ]}
                value={tab}
                onChange={setTab}
                className="max-w-md"
            />

            {tab === 'weekly' ? (
                <div className="space-y-5">
                    {loading ? (
                        <div className="text-center p-10 font-mono text-2xs uppercase tracking-wider text-text-mute">
                            Brewing the roast…
                        </div>
                    ) : !hasWeeklyData ? (
                        <div className="text-center p-12 space-y-3 bg-bg-1 rounded-xl border border-line">
                            <Flame className="w-10 h-10 text-text-mute mx-auto" aria-hidden="true" />
                            <h3 className="font-display text-lg font-semibold text-text">No Roast Material Yet</h3>
                            <p className="text-sm text-text-dim max-w-md mx-auto">
                                The Roast fires up once the NFL season kicks off and your league has completed matchups.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <label className="font-mono text-2xs uppercase tracking-wider text-text-mute">Week</label>
                                    <select
                                        value={selectedWeek || ''}
                                        onChange={(e) => setSelectedWeek(Number(e.target.value))}
                                        className="bg-bg-2 border border-line text-text rounded-md px-3 min-h-[36px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast tnum"
                                    >
                                        {availableWeeks.map(w => (
                                            <option key={w} value={w}>Week {w}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={copyToClipboard} variant="outline" className="gap-2 border-line text-text hover:bg-bg-2">
                                        <Copy className="w-4 h-4" /> Copy Text
                                    </Button>
                                    <Button onClick={downloadImage} className="gap-2 bg-signal text-ink font-semibold hover:bg-signal/90">
                                        <Download className="w-4 h-4" /> Save Image
                                    </Button>
                                </div>
                            </div>

                            <div ref={captureRef} className="p-6 rounded-xl bg-bg border border-line shadow-pop relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                    <Trophy className="w-64 h-64" />
                                </div>

                                <div className="mb-6 relative z-10">
                                    <h3 className="font-display text-xl font-bold text-text mb-1">{league.name}</h3>
                                    <p className="font-mono text-2xs uppercase tracking-wider text-signal-2 font-bold">
                                        Week <span className="tnum">{selectedWeek}</span> Recap
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                                    {stats.robbery && (
                                        <RoastCard tone="bad" icon={AlertTriangle} title="The Robbery" manager={stats.robbery.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.robbery?.text || '', getCardData('robbery'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.robbery?.sub || '', getCardData('robbery'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.worstManager && (
                                        <RoastCard tone="warn" icon={TrendingUp} title="Manager Malpractice" manager={stats.worstManager.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.worstManager?.text || '', getCardData('worstManager'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.worstManager?.sub || '', getCardData('worstManager'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.boomGame && (
                                        <RoastCard tone="signal2" icon={Flame} title="Boom Game" manager="Player of the Week">
                                            <div className="flex items-center gap-3 mb-2">
                                                <PlayerHeadshot playerId={stats.boomGame.player.player_id} lastName={stats.boomGame.player.last_name} ringTone="border-signal-2/40" />
                                                <div>
                                                    <div className="font-semibold text-text text-sm">{stats.boomGame.player.first_name} {stats.boomGame.player.last_name}</div>
                                                    <div className="text-signal-2 font-mono font-bold text-sm tnum">{stats.boomGame.points} pts</div>
                                                </div>
                                            </div>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.boomGame?.text || '', getCardData('boomGame'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.boomGame?.sub || '', getCardData('boomGame'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.topRookie && (
                                        <RoastCard tone="good" icon={Trophy} title="The Dynasty Flex" manager="Rookie of the Week">
                                            <div className="flex items-center gap-3 mb-2">
                                                <PlayerHeadshot playerId={stats.topRookie.player.player_id} lastName={stats.topRookie.player.last_name} ringTone="border-good/40" />
                                                <div>
                                                    <div className="font-semibold text-text text-sm">{stats.topRookie.player.first_name} {stats.topRookie.player.last_name}</div>
                                                    <div className="text-good font-mono font-bold text-sm tnum">{stats.topRookie.points} pts</div>
                                                    <div className="font-mono text-2xs text-text-mute uppercase tracking-wider">Mgr · {stats.topRookie.manager}</div>
                                                </div>
                                            </div>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.topRookie?.text || '', getCardData('topRookie'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.bagCarrier && (
                                        <RoastCard tone="signal" icon={Dumbbell} title="The Backpack Award" manager={stats.bagCarrier.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.bagCarrier?.text || '', getCardData('bagCarrier'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.bagCarrier?.sub || '', getCardData('bagCarrier'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.tankCommander && (
                                        <RoastCard tone="signal2" icon={TrendingDown} title="Tank Commander" manager={stats.tankCommander.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.tankCommander?.text || '', getCardData('tankCommander'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.tankCommander?.sub || '', getCardData('tankCommander'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.luckyCharm && (
                                        <RoastCard tone="good" icon={Sparkles} title="Lucky Charm" manager={stats.luckyCharm.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.luckyCharm?.text || '', getCardData('luckyCharm'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.luckyCharm?.sub || '', getCardData('luckyCharm'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.closeCall && (
                                        <RoastCard tone="signal" icon={Timer} title="Close Call" manager={stats.closeCall.winner}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.closeCall?.text || '', getCardData('closeCall'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.closeCall?.sub || '', getCardData('closeCall'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.coinFlipFail && (
                                        <RoastCard tone="warn" icon={Shuffle} title="The Coin Flip Fail" manager={stats.coinFlipFail.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.coinFlipFail?.text || '', getCardData('coinFlipFail'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.coinFlipFail?.sub || '', getCardData('coinFlipFail'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.ghost && (
                                        <RoastCard tone="neutral" icon={Ghost} title="The Ghost" manager={stats.ghost.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.ghost?.text || '', getCardData('ghost'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.ghost?.sub || '', getCardData('ghost'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.cardioKing && (
                                        <RoastCard tone="neutral" icon={Percent} title="The Cardio Kings" manager={stats.cardioKing.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.cardioKing?.text || '', getCardData('cardioKing'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.cardioKing?.sub || '', getCardData('cardioKing'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.overachiever && (
                                        <RoastCard tone="good" icon={TrendingUp} title="The Overachiever" manager={stats.overachiever.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.overachiever?.text || '', getCardData('overachiever'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.overachiever?.sub || '', getCardData('overachiever'))}</p>
                                        </RoastCard>
                                    )}

                                    {stats.underachiever && (
                                        <RoastCard tone="bad" icon={TrendingDown} title="The Underachiever" manager={stats.underachiever.manager}>
                                            <p className="text-text-dim text-sm">{fillTemplate(roastCopy.underachiever?.text || '', getCardData('underachiever'))}</p>
                                            <p className="mt-2 text-xs text-text-mute">{fillTemplate(roastCopy.underachiever?.sub || '', getCardData('underachiever'))}</p>
                                        </RoastCard>
                                    )}
                                </div>

                                <div className="mt-6 pt-5 border-t border-line flex items-center justify-between relative z-10 gap-3">
                                    <div className="min-w-0">
                                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">Generated by</p>
                                        <p
                                            className="font-display text-lg font-bold"
                                            style={{
                                                background: 'linear-gradient(90deg, var(--signal), var(--signal-2))',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                backgroundClip: 'text',
                                            }}
                                        >
                                            League Analysis
                                        </p>
                                        <p className="font-mono text-2xs text-text-mute mt-1 truncate">
                                            Find your league's roast at {window.location.host}
                                        </p>
                                    </div>
                                    <div className="bg-white p-2 rounded-md shrink-0">
                                        <QRCode
                                            size={64}
                                            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                            value={leagueUrl}
                                            viewBox={`0 0 256 256`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <SeasonSuperlativesView
                    league={league}
                    rosters={rosters}
                    users={users}
                    players={players}
                    seasonMatchups={seasonMatchups}
                    seasonMatchupsLoading={seasonMatchupsLoading}
                    currentWeek={currentWeek}
                />
            )}
        </div>
    );
};

export default WeeklyRecap;
