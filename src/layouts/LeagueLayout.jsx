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
    const { user, loadHistory } = useSleeper();
    const { league, rosters, users, players, state, matchups, tradedPicks, loading, error } = useLeagueData(leagueId);
    const [transactions, setTransactions] = useState([]);

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
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] text-destructive">
                Error loading league data: {error.message}
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

            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 bg-card/50 p-6 rounded-xl border border-border backdrop-blur-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">League Analysis</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        League ID: <span className="font-mono text-primary">{leagueId}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        className="px-3 sm:px-4 py-2 rounded-md border border-input bg-background/50 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-xs sm:text-sm w-full sm:w-64 placeholder:text-muted-foreground"
                        placeholder="Enter League ID"
                        defaultValue={leagueId}
                        onKeyDown={handleLeagueChange}
                    />
                    <Button
                        onClick={() => {
                            const el = document.querySelector("input[placeholder='Enter League ID']");
                            if (el?.value) navigate(`/league/${el.value.trim()}`);
                        }}
                    >
                        Load
                    </Button>
                </div>
            </header>

            <div className="mb-8">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="gap-2 mb-4 pl-0 hover:bg-transparent hover:text-primary transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Button>

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
                        currentWeek: state?.display_week ?? state?.week ?? state?.leg ?? 1,
                        matchups,
                        transactions,
                        tradedPicks,
                        loading,
                        error
                    }} />
                </PageTransition>
            </AnimatePresence>
        </div>
    );
};

export default LeagueLayout;
