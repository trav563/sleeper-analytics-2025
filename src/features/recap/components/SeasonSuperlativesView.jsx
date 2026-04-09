import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { useSeasonSuperlatives } from '../hooks/useSeasonSuperlatives';
import { SEASON_COPY, getRandomCopy, fillTemplate } from '../data/roastCopy';
import { AlertTriangle, Crown, Dumbbell, TrendingDown, Ghost, Shuffle, Sparkles, Flame, Loader2 } from 'lucide-react';

const SeasonSuperlativesView = ({ league, rosters, users, players, seasonMatchups, seasonMatchupsLoading, currentWeek }) => {
    const superlatives = useSeasonSuperlatives(league, seasonMatchups, rosters, users, players, currentWeek);

    // Lock in random copy
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
            <div className="text-center p-10 text-muted-foreground animate-pulse flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Crunching the season numbers...
            </div>
        );
    }

    if (!superlatives) {
        return (
            <div className="text-center p-16 text-muted-foreground space-y-3">
                <div className="text-4xl">🏆</div>
                <h3 className="text-lg font-semibold text-foreground">Not Enough Data Yet</h3>
                <p className="text-sm max-w-md mx-auto">Season Superlatives need at least 3 completed weeks of matchups. Check back as the season progresses!</p>
            </div>
        );
    }

    const cards = [
        {
            key: 'mostRobbed',
            data: superlatives.mostRobbed,
            icon: AlertTriangle,
            iconColor: 'text-red-500',
            borderColor: 'border-red-900/50',
            bgColor: 'bg-red-950/20',
            title: 'Most Robbed',
            manager: superlatives.mostRobbed?.manager,
        },
        {
            key: 'luckiestManager',
            data: superlatives.luckiestManager,
            icon: Sparkles,
            iconColor: 'text-emerald-400',
            borderColor: 'border-emerald-900/50',
            bgColor: 'bg-emerald-950/20',
            title: 'Luckiest Manager',
            manager: superlatives.luckiestManager?.manager,
        },
        {
            key: 'seasonMVP',
            data: superlatives.seasonMVP,
            icon: Flame,
            iconColor: 'text-orange-400',
            borderColor: 'border-orange-900/50',
            bgColor: 'bg-gradient-to-br from-red-950/20 to-orange-950/20',
            title: 'Season MVP',
            manager: superlatives.seasonMVP ? `${superlatives.seasonMVP.playerName}` : null,
        },
        {
            key: 'seasonTank',
            data: superlatives.seasonTank,
            icon: TrendingDown,
            iconColor: 'text-purple-400',
            borderColor: 'border-purple-900/50',
            bgColor: 'bg-purple-950/20',
            title: 'Season Low',
            manager: superlatives.seasonTank?.manager,
        },
        {
            key: 'benchWarmer',
            data: superlatives.benchWarmer,
            icon: Crown,
            iconColor: 'text-orange-500',
            borderColor: 'border-orange-900/50',
            bgColor: 'bg-orange-950/20',
            title: 'Bench Warmer',
            manager: superlatives.benchWarmer?.manager,
        },
        {
            key: 'backpackAllStar',
            data: superlatives.backpackAllStar,
            icon: Dumbbell,
            iconColor: 'text-blue-500',
            borderColor: 'border-blue-900/50',
            bgColor: 'bg-blue-950/20',
            title: 'Backpack All-Star',
            manager: superlatives.backpackAllStar?.manager,
        },
        {
            key: 'ghostHunter',
            data: superlatives.ghostHunter,
            icon: Ghost,
            iconColor: 'text-slate-400',
            borderColor: 'border-slate-600/50',
            bgColor: 'bg-slate-800/20',
            title: 'Ghost Hunter',
            manager: superlatives.ghostHunter?.manager,
        },
        {
            key: 'coinFlipChamp',
            data: superlatives.coinFlipChamp,
            icon: Shuffle,
            iconColor: 'text-yellow-500',
            borderColor: 'border-yellow-900/50',
            bgColor: 'bg-yellow-950/20',
            title: 'Coin Flip Champion',
            manager: superlatives.coinFlipChamp?.manager,
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400">Aggregated across {superlatives.weeksAnalyzed} weeks of matchups</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cards.map(card => {
                    if (!card.data) return null;
                    const Icon = card.icon;
                    const cardCopy = copy[card.key];
                    const templateData = card.data;

                    return (
                        <Card key={card.key} className={`${card.borderColor} ${card.bgColor} backdrop-blur-sm`}>
                            <CardHeader className="pb-2">
                                <div className={`flex items-center gap-2 ${card.iconColor} mb-2`}>
                                    <Icon className="w-5 h-5" />
                                    <span className="font-bold uppercase tracking-wider text-xs">{card.title}</span>
                                </div>
                                <CardTitle className="text-xl">{card.manager}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {card.key === 'seasonMVP' && card.data.player && (
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-800 border border-orange-500/30 shrink-0">
                                            <img
                                                src={`https://sleepercdn.com/content/nfl/players/${card.data.player.player_id}.jpg`}
                                                alt={card.data.player.last_name}
                                                className="h-full w-full object-cover"
                                                onError={(e) => e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'}
                                            />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-sm">{card.data.playerName}</div>
                                            <div className="text-orange-400 font-mono font-bold text-sm">{card.data.points} pts</div>
                                            <div className="text-xs text-muted-foreground">Week {card.data.week}</div>
                                        </div>
                                    </div>
                                )}
                                <p className="text-slate-300 text-sm">
                                    {cardCopy ? fillTemplate(cardCopy.text, templateData) : ''}
                                </p>
                                {cardCopy?.sub && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {fillTemplate(cardCopy.sub, templateData)}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default SeasonSuperlativesView;
