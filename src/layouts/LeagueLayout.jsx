import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useSleeper } from '../context/SleeperContext';
import { useLeagueData } from '../features/league/hooks/useLeagueData';
import { fetchLeagueTransactions } from '../utils/sleeper';
import { deriveCurrentWeek, isSeasonStarted } from '../utils/seasonState';
import PageTransition from '../components/PageTransition';
import RouteErrorBoundary from '../components/RouteErrorBoundary';
import ErrorState from '../components/ui/ErrorState';

const LeagueLayout = () => {
    const { leagueId } = useParams();
    const location = useLocation();
    const { user, loadHistory, findChainContaining, selectActiveChain } = useSleeper();
    const { league, rosters, users, players, state, matchups, tradedPicks, drafts, loading, error, refresh } = useLeagueData(leagueId);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        if (!leagueId || !user?.user_id) return;
        // Prefer the pre-walked chain that contains this league so the season
        // selector exposes both prior AND future seasons. Fall back to walking
        // backward from the URL leagueId for deep-linked leagues outside the
        // user's getLeagues list.
        const cached = findChainContaining(leagueId);
        if (cached?.length) {
            selectActiveChain(cached);
        } else {
            loadHistory(leagueId, user.user_id);
        }
    }, [leagueId, user, loadHistory, findChainContaining, selectActiveChain]);

    const currentWeek = deriveCurrentWeek(league, state);
    const seasonStarted = isSeasonStarted(league, state);

    useEffect(() => {
        const controller = new AbortController();
        const getTransactions = async () => {
            if (leagueId && currentWeek) {
                try {
                    const data = await fetchLeagueTransactions(leagueId, currentWeek, { signal: controller.signal });
                    setTransactions(data);
                } catch (err) {
                    if (!controller.signal.aborted) console.error("Failed to fetch transactions", err);
                }
            }
        };
        getTransactions();
        return () => controller.abort();
    }, [leagueId, currentWeek]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-line border-t-signal animate-spin" />
                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    Loading league data…
                </span>
            </div>
        );
    }

    if (error) {
        return (
            <ErrorState
                className="h-[calc(100vh-4rem)]"
                message={`Error loading league data: ${error.message}`}
                onRetry={refresh}
            />
        );
    }

    return (
        <>
            <Helmet>
                <title>{league ? `${league.name} Analysis | League Analysis` : 'League Analysis'}</title>
                <meta name="description" content={league ? `View trade analysis, power rankings, and draft ROI for ${league.name}.` : "View trade analysis, power rankings, and draft ROI for your fantasy league."} />
                <meta property="og:title" content={league ? `${league.name} Analysis | League Analysis` : 'League Analysis'} />
                <meta property="og:description" content={league ? `View trade analysis, power rankings, and draft ROI for ${league.name}.` : "View trade analysis, power rankings, and draft ROI for your fantasy league."} />
                <meta property="og:image" content="/favicon.png" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={window.location.href} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={league ? `${league.name} Analysis | League Analysis` : 'League Analysis'} />
                <meta name="twitter:description" content={league ? `View trade analysis, power rankings, and draft ROI for ${league.name}.` : "View trade analysis, power rankings, and draft ROI for your fantasy league."} />
                <meta name="twitter:image" content="/favicon.png" />
            </Helmet>

            <AnimatePresence mode="wait">
                <PageTransition key={location.pathname} className="min-h-[50vh]">
                    <RouteErrorBoundary key={location.pathname}>
                    <Outlet context={{
                        league,
                        rosters,
                        users,
                        players,
                        user,
                        state,
                        currentWeek,
                        seasonStarted,
                        matchups,
                        transactions,
                        tradedPicks,
                        drafts,
                        loading,
                        error
                    }} />
                    </RouteErrorBoundary>
                </PageTransition>
            </AnimatePresence>
        </>
    );
};

export default LeagueLayout;
