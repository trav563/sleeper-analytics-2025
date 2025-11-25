import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useSleeper } from '../context/SleeperContext';
import { useLeagueData } from '../features/league/hooks/useLeagueData';
import LeagueCard from '../features/league/components/LeagueCard';
import { ArrowLeft } from 'lucide-react';
import { fetchLeagueTransactions } from '../utils/sleeper';

const LeagueLayout = () => {
    const { leagueId } = useParams();
    const navigate = useNavigate();
    const { user, loadHistory } = useSleeper();
    const { league, rosters, users, players, state, matchups, loading, error } = useLeagueData(leagueId);
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
            <div className="flex justify-center items-center h-screen text-white">
                Loading league data...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen text-red-500">
                Error loading league data: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">League Analysis</h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        League ID: {leagueId}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        className="px-3 sm:px-4 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm w-full sm:w-64"
                        placeholder="Enter League ID"
                        defaultValue={leagueId}
                        onKeyDown={handleLeagueChange}
                    />
                    <button
                        className="px-3 sm:px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-blue-500 active:bg-blue-700 flex-shrink-0"
                        onClick={() => {
                            const el = document.querySelector("input[placeholder='Enter League ID']");
                            if (el?.value) navigate(`/league/${el.value.trim()}`);
                        }}
                    >
                        Load
                    </button>
                </div>
            </header>

            <div className="mb-8">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>

                {league && <LeagueCard league={league} />}
            </div>

            <Outlet context={{
                league,
                rosters,
                users,
                players,
                user,
                state,
                currentWeek: state?.display_week || state?.week || state?.leg,
                matchups,
                transactions, // Pass transactions to child routes
                loading,
                error
            }} />
        </div>
    );
};

export default LeagueLayout;
