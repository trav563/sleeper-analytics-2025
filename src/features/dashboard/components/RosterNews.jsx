import { usePlayerNews } from '../hooks/usePlayerNews';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Newspaper, ExternalLink, Clock, Flame } from 'lucide-react';

const RosterNews = ({ roster, players }) => {
    const { personalNews, topHeadlines, isLoading } = usePlayerNews(roster, players);

    // Determines if news is "Breaking" (< 1 hour old)
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

    // Format relative time (e.g. "2h ago")
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

    const NewsItem = ({ item }) => (
        <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="block mb-3 last:mb-0 group"
        >
            <div className="bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-lg p-3 transition-all relative overflow-hidden">
                {isBreaking(item.pubDate) && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/10 text-red-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded animate-pulse">
                        <Flame className="w-3 h-3" />
                        Breaking
                    </div>
                )}

                <h4 className="font-semibold text-white text-sm pr-16 group-hover:text-blue-400 transition-colors">
                    {item.title}
                </h4>

                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(item.pubDate)}</span>
                </div>
            </div>
        </a>
    );

    if (isLoading) {
        return (
            <Card className="bg-slate-800/50 border-slate-700 h-full">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2 text-base">
                        <Newspaper className="w-5 h-5 text-blue-400" />
                        Roster News
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="h-16 w-full bg-slate-800 rounded animate-pulse" />
                        <div className="h-16 w-full bg-slate-800 rounded animate-pulse" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const hasNews = personalNews && personalNews.length > 0;
    const displayNews = hasNews ? personalNews : topHeadlines;

    return (
        <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                        <Newspaper className="w-5 h-5 text-blue-400" />
                        Roster News
                    </div>
                    {hasNews && (
                        <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                            {personalNews.length} Updates
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {!hasNews && (
                    <p className="text-xs text-slate-400 mb-3 italic">
                        No recent news for your roster. Here are the top headlines:
                    </p>
                )}

                <div className="space-y-1">
                    {displayNews.map((item, idx) => (
                        <NewsItem key={idx} item={item} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default RosterNews;
