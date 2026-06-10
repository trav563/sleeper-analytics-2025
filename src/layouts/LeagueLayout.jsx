import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useSleeper } from '../context/SleeperContext';
import { useLeagueData } from '../features/league/hooks/useLeagueData';
import LeagueCard from '../features/league/components/LeagueCard';
import { ArrowLeft } from 'lucide-react';
import { fetchLeagueTransactions } from '../utils/sleeper';
import { Button } from '../components/ui/Button';
import PageTransition from '../components/PageTransition';

const LeagueLayout = () => {
    const { leagueId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loadHistory, setLastLeague } = useSleeper();
    const { league, rosters, users, players, state, matchups, tradedPicks, loading, error, refresh } = useLeagueData(leagueId);
    const [transactions, setTransactions] = useState([]);

    // Persist this league as the last-viewed league for auto-redirect
    useEffect(() => {
        if (leagueId && !loading && !error) {
            setLastLeague(leagueId);
        }
    }, [leagueId, loading, error, setLastLeague]);

    useEffect(() => {
        if (leagueId && user?.user_id) {
            loadHistory(leagueId, user.user_id);
        }
    }, [leagueId, user, loadHistory]);

    // Fetch transactions for the current week
    useEffect(() => {
        const getTransactions = async () => {
            if (leagueId && state?.display_week) {
                try {
                    const data = await fetchLeagueTransactions(leagueId, state.display_week);
                    setTransactions(data);
                } catch (err) {
                    console.error("Failed to fetch transactions", err);
                }
            }
        };
        getTransactions();
    }, [leagueId, state?.display_week]);

    const handleLeagueChange = (e) => {
        if (e.key === "Enter") {
            navigate(`/league/${e.target.value.trim()}`);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] text-muted-foreground animate-pulse">
                Loading league data...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-[calc(100vh-4rem)] gap-4">
                <div className="text-center space-y-3 p-8 rounded-xl bg-card border border-border max-w-md">
                    <p className="text-destructive font-medium">Failed to load league data</p>
                    <p className="text-sm text-muted-foreground">This could be a network issue or an invalid league ID.</p>
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            onClick={refresh}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 text-sm font-medium rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 pb-12">
            <Helmet>
                <title>{league ? `${league.name} Analysis | League Analysis` : 'League Analysis'}</title>
                <meta name="description" content={league ? `View trade analysis, power rankings, and draft ROI for ${league.name}.` : "View trade analysis, power rankings, and draft ROI for your fantasy league."} />

                {/* Check if we have a trophy icon in public dir (assuming favicon.png for now based on file check) */}
                {/* Standard OGP */}
                <meta property="og:title" content={league ? `${league.name} Analysis | League Analysis` : 'League Analysis'} />
                <meta property="og:description" content={league ? `View trade analysis, power rankings, and draft ROI for ${league.name}.` : "View trade analysis, power rankings, and draft ROI for your fantasy league."} />
                <meta property="og:image" content="/favicon.png" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={window.location.href} />

                {/* Twitter Card */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={league ? `${league.name} Analysis | League Analysis` : 'League Analysis'} />
                <meta name="twitter:description" content={league ? `View trade analysis, power rankings, and draft ROI for ${league.name}.` : "View trade analysis, power rankings, and draft ROI for your fantasy league."} />
                <meta name="twitter:image" content="/favicon.png" />
            </Helmet>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="gap-2 pl-0 hover:bg-transparent hover:text-primary transition-colors text-muted-foreground"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to User Home
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card/50 px-4 py-2 rounded-lg border border-border backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">League ID:</span>
                        <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{leagueId}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:ml-4">
                        <input
                            className="px-3 py-1.5 rounded-md border border-input bg-background/50 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-xs w-full sm:w-48 placeholder:text-muted-foreground"
                            placeholder="Switch League ID..."
                            defaultValue={leagueId}
                            onKeyDown={handleLeagueChange}
                        />
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                const el = document.querySelector("input[placeholder='Switch League ID...']");
                                if (el?.value) navigate(`/league/${el.value.trim()}`);
                            }}
                        >
                            Load
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mb-8">
                {league && <LeagueCard league={league} />}
            </div>

            <AnimatePresence mode="wait">
                <PageTransition key={location.pathname} className="min-h-[50vh]">
                    <Outlet context={{
                        league,
                        rosters,
                        users,
                        players,
                        user,
                        state,
                        currentWeek: league?.status === 'complete' ? (league.settings?.playoff_week_start ? league.settings.playoff_week_start + 2 : 17) : (state?.display_week || state?.week || state?.leg),
                        matchups,
                        transactions,
                        tradedPicks,
                        loading,
                        error,
                        refresh
                    }} />
                </PageTransition>
            </AnimatePresence>
        </div>
    );
};

export default LeagueLayout;

