import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useSleeper } from '../context/SleeperContext';
import { useLeagueData } from '../features/league/hooks/useLeagueData';
import LeagueCard from '../features/league/components/LeagueCard';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
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
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] px-4">
                <div className="max-w-md w-full p-4 rounded-md bg-bad/10 border border-bad/30 text-bad text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>Error loading league data: {error.message}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 pb-12">
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

            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 bg-bg-1 p-5 rounded-xl border border-line shadow-card">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        League ID · <span className="tnum text-text-dim">{leagueId}</span>
                    </div>
                    <h1 className="mt-1 font-display text-2xl md:text-3xl font-bold tracking-snug text-text">
                        League Analysis
                    </h1>
                </div>
                <div className="flex items-stretch gap-2">
                    <input
                        className="px-3 py-2 min-h-[40px] rounded-md border border-line bg-bg-2 text-text text-sm placeholder:text-text-mute focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal w-full sm:w-64 transition-colors duration-fast"
                        placeholder="Enter League ID"
                        defaultValue={leagueId}
                        onKeyDown={handleLeagueChange}
                    />
                    <Button
                        onClick={() => {
                            const el = document.querySelector("input[placeholder='Enter League ID']");
                            if (el?.value) navigate(`/league/${el.value.trim()}`);
                        }}
                        className="bg-signal text-[#0B0C10] font-semibold hover:bg-signal/90"
                    >
                        Load
                    </Button>
                </div>
            </header>

            <div>
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="gap-2 mb-4 pl-0 text-text-dim hover:bg-transparent hover:text-signal transition-colors duration-fast"
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
