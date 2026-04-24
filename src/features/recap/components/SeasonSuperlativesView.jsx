import { useMemo } from 'react';
import { useSeasonSuperlatives } from '../hooks/useSeasonSuperlatives';
import { SEASON_COPY, getRandomCopy, fillTemplate } from '../data/roastCopy';
import { AlertTriangle, Crown, Dumbbell, TrendingDown, Ghost, Shuffle, Sparkles, Flame, Loader2, Trophy } from 'lucide-react';

const TONE = {
    bad:      { border: 'border-bad/40',      bg: 'bg-bad/10',      text: 'text-bad' },
    warn:     { border: 'border-warn/40',     bg: 'bg-warn/10',     text: 'text-warn' },
    signal:   { border: 'border-signal/40',   bg: 'bg-signal/10',   text: 'text-signal' },
    signal2:  { border: 'border-signal-2/40', bg: 'bg-signal-2/10', text: 'text-signal-2' },
    good:     { border: 'border-good/40',     bg: 'bg-good/10',     text: 'text-good' },
    neutral:  { border: 'border-line',        bg: 'bg-bg-2/50',     text: 'text-text-dim' },
};

const SuperlativeCard = ({ tone, icon: Icon, title, manager, children }) => {
    const t = TONE[tone] || TONE.neutral;
    return (
        <section className={`rounded-xl border ${t.border} ${t.bg} backdrop-blur-sm shadow-card`}>
            <header className="px-4 pt-4 pb-2">
                <div className={`flex items-center gap-2 ${t.text} mb-2`}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span className="font-mono text-2xs uppercase tracking-wider font-bold">{title}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-text">{manager}</h3>
            </header>
            <div className="px-4 pb-4">{children}</div>
        </section>
    );
};

const SeasonSuperlativesView = ({ league, rosters, users, players, seasonMatchups, seasonMatchupsLoading, currentWeek }) => {
    const superlatives = useSeasonSuperlatives(league, seasonMatchups, rosters, users, players, currentWeek);

    const copy = useMemo(() => {
        if (!superlatives) return {};
        const picks = {};
        Object.keys(SEASON_COPY).forEach(key => {
            picks[key] = getRandomCopy(SEASON_COPY, key);
        });
        return picks;
    }, [superlatives]);

    if (seasonMatchupsLoading) {
        return (
            <div className="text-center p-10 font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-signal" />
                Crunching the season numbers…
            </div>
        );
    }

    if (!superlatives) {
        return (
            <div className="text-center p-12 space-y-3 bg-bg-1 rounded-xl border border-line">
                <Trophy className="w-10 h-10 text-text-mute mx-auto" aria-hidden="true" />
                <h3 className="font-display text-lg font-semibold text-text">Not Enough Data Yet</h3>
                <p className="text-sm text-text-dim max-w-md mx-auto">
                    Season superlatives need at least 3 completed weeks of matchups. Check back as the season progresses.
                </p>
            </div>
        );
    }

    const cards = [
        { key: 'mostRobbed',       data: superlatives.mostRobbed,       icon: AlertTriangle, tone: 'bad',     title: 'Most Robbed',       manager: superlatives.mostRobbed?.manager },
        { key: 'luckiestManager',  data: superlatives.luckiestManager,  icon: Sparkles,      tone: 'good',    title: 'Luckiest Manager',  manager: superlatives.luckiestManager?.manager },
        { key: 'seasonMVP',        data: superlatives.seasonMVP,        icon: Flame,         tone: 'signal2', title: 'Season MVP',        manager: superlatives.seasonMVP?.playerName },
        { key: 'seasonTank',       data: superlatives.seasonTank,       icon: TrendingDown,  tone: 'signal2', title: 'Season Low',        manager: superlatives.seasonTank?.manager },
        { key: 'benchWarmer',      data: superlatives.benchWarmer,      icon: Crown,         tone: 'warn',    title: 'Bench Warmer',      manager: superlatives.benchWarmer?.manager },
        { key: 'backpackAllStar',  data: superlatives.backpackAllStar,  icon: Dumbbell,      tone: 'signal',  title: 'Backpack All-Star', manager: superlatives.backpackAllStar?.manager },
        { key: 'ghostHunter',      data: superlatives.ghostHunter,      icon: Ghost,         tone: 'neutral', title: 'Ghost Hunter',      manager: superlatives.ghostHunter?.manager },
        { key: 'coinFlipChamp',    data: superlatives.coinFlipChamp,    icon: Shuffle,       tone: 'warn',    title: 'Coin Flip Champion', manager: superlatives.coinFlipChamp?.manager },
    ];

    return (
        <div className="space-y-5">
            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                Aggregated across <span className="tnum text-text-dim">{superlatives.weeksAnalyzed}</span> weeks of matchups
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cards.map(card => {
                    if (!card.data) return null;
                    const cardCopy = copy[card.key];
                    const templateData = card.data;

                    return (
                        <SuperlativeCard key={card.key} tone={card.tone} icon={card.icon} title={card.title} manager={card.manager}>
                            {card.key === 'seasonMVP' && card.data.player && (
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-bg-3 border border-signal-2/40 shrink-0">
                                        <img
                                            src={`https://sleepercdn.com/content/nfl/players/${card.data.player.player_id}.jpg`}
                                            alt={card.data.player.last_name}
                                            className="h-full w-full object-cover"
                                            onError={(e) => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
                                        />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-text text-sm">{card.data.playerName}</div>
                                        <div className="text-signal-2 font-mono font-bold text-sm tnum">{card.data.points} pts</div>
                                        <div className="font-mono text-2xs text-text-mute uppercase tracking-wider">Week <span className="tnum">{card.data.week}</span></div>
                                    </div>
                                </div>
                            )}
                            <p className="text-text-dim text-sm">{cardCopy ? fillTemplate(cardCopy.text, templateData) : ''}</p>
                            {cardCopy?.sub && (
                                <p className="mt-2 text-xs text-text-mute">{fillTemplate(cardCopy.sub, templateData)}</p>
                            )}
                        </SuperlativeCard>
                    );
                })}
            </div>
        </div>
    );
};

export default SeasonSuperlativesView;
