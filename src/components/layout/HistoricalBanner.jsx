import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useSleeper } from '../../context/SleeperContext';

const HistoricalBanner = ({ message }) => {
    const { leagueId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { leagueHistory } = useSleeper();

    if (!Array.isArray(leagueHistory) || leagueHistory.length < 2) return null;
    const currentLeague = leagueHistory[0];
    if (!currentLeague?.league_id || currentLeague.league_id === leagueId) return null;

    const tail = location.pathname.replace(/^\/league\/[^/]+/, '');
    const switchToCurrent = () => navigate(`/league/${currentLeague.league_id}${tail || ''}`);

    const viewing = leagueHistory.find((l) => l.league_id === leagueId);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3 rounded-md bg-warn/10 border border-warn/30 text-warn">
            <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="text-sm">
                    <span className="font-mono text-2xs uppercase tracking-wider font-bold mr-2">
                        Historical · {viewing?.season ?? 'Past Season'}
                    </span>
                    <span className="text-text">
                        {message || 'This page is most useful for the current season.'}
                    </span>
                </div>
            </div>
            <button
                type="button"
                onClick={switchToCurrent}
                className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-md bg-warn/20 hover:bg-warn/30 text-warn font-semibold text-xs transition-colors duration-fast"
            >
                Switch to current
                <ArrowRight className="h-3.5 w-3.5" />
            </button>
        </div>
    );
};

export default HistoricalBanner;
