import { usePlayerNews } from '../hooks/usePlayerNews';
import { Newspaper, Clock, Flame, Activity } from 'lucide-react';
import { LiveDot } from '../../../components/ui/LiveDot';
import InjuryReport from './InjuryReport';

const isBreaking = (dateString) => {
    try {
        const newsDate = new Date(dateString);
        const now = new Date();
        const diffInHours = (now - newsDate) / 1000 / 60 / 60;
        return diffInHours < 1.0;
    } catch {
        return false;
    }
};

const formatTime = (dateString) => {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
        return '';
    }
};

const NewsItem = ({ item }) => {
    const isAlert = item.type === 'alert';
    const cardClass = isAlert
        ? 'bg-bad/10 border-bad/30 hover:bg-bad/15'
        : 'bg-bg-2 border-line hover:bg-bg-3';

    return (
        <a
            href={item.link || '#'}
            target={item.link ? '_blank' : '_self'}
            rel="noreferrer"
            className={`block mb-2 last:mb-0 group ${!item.link ? 'cursor-default' : ''}`}
        >
            <div className={`border rounded-md p-3 transition-colors duration-fast ${cardClass}`}>
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold text-sm group-hover:text-signal transition-colors duration-fast ${isAlert ? 'text-bad' : 'text-text'}`}>
                            {isAlert && <Activity className="w-3 h-3 inline-block mr-1.5 -mt-0.5" aria-hidden="true" />}
                            {item.title}
                        </h4>

                        <div className="flex items-center gap-2 mt-2 font-mono text-2xs uppercase tracking-wider text-text-mute">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            <span>{isAlert ? 'Live Update' : formatTime(item.pubDate)}</span>
                            {item.trending === 'down' && (
                                <span className="inline-flex items-center gap-1 text-bad bg-bad/10 px-1.5 py-0.5 rounded-sm border border-bad/30 ml-1">
                                    Selling Off · <span className="tnum">{item.count}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {isBreaking(item.pubDate) && !isAlert && (
                        <div className="flex items-center gap-1 bg-signal-2/15 text-signal-2 font-mono text-2xs uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm border border-signal-2/30 shrink-0">
                            <Flame className="w-3 h-3" aria-hidden="true" />
                            Breaking
                        </div>
                    )}
                </div>
            </div>
        </a>
    );
};

const RosterNews = ({ roster, players }) => {
    const { personalNews, topHeadlines, isLoading } = usePlayerNews(roster, players);

    if (isLoading) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line shadow-card">
                <header className="px-4 pt-3 pb-2 border-b border-line flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-md font-semibold text-text">Roster News</h3>
                </header>
                <div className="px-4 py-4 space-y-2">
                    <div className="h-16 w-full bg-bg-2 rounded-md animate-pulse" />
                    <div className="h-16 w-full bg-bg-2 rounded-md animate-pulse" />
                </div>
            </section>
        );
    }

    const hasNews = personalNews && personalNews.length > 0;
    const displayNews = hasNews ? personalNews : topHeadlines;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card flex flex-col">
            <header className="px-4 pt-3 pb-2 border-b border-line flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-signal" aria-hidden="true" />
                    <h3 className="font-display text-md font-semibold text-text">Roster News</h3>
                    {hasNews && <LiveDot />}
                </div>
                {hasNews && (
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2 px-2 py-0.5 rounded-sm border border-line">
                        <span className="tnum">{personalNews.length}</span> Updates
                    </span>
                )}
            </header>

            <div className="flex-1 overflow-y-auto max-h-[400px] px-4 py-3">
                {!hasNews && (
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-3 italic">
                        No recent news for your roster · top headlines:
                    </p>
                )}

                <div className="space-y-1">
                    {displayNews.map((item, idx) => (
                        <NewsItem key={idx} item={item} />
                    ))}
                </div>
            </div>

            <InjuryReport roster={roster} players={players} />
        </section>
    );
};

export default RosterNews;
