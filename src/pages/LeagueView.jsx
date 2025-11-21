import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LineupChecker from '../features/league/components/LineupChecker';
import LeagueCard from '../features/league/components/LeagueCard';
import TrueStandings from '../features/analytics/components/TrueStandings';
import TeamRadar from '../features/analytics/components/TeamRadar';
import RivalryMatrix from '../features/analytics/components/RivalryMatrix';
import TradeFinder from '../features/tools/components/TradeFinder';
import DraftAnalysis from '../features/tools/components/DraftAnalysis';
import { useSleeper } from '../context/SleeperContext';
import { useLeagueData } from '../features/league/hooks/useLeagueData';
import { ArrowLeft, BarChart2, Grid, Users, Wrench } from 'lucide-react';

const LeagueView = () => {
    const { leagueId } = useParams();
    const navigate = useNavigate();
    const { user, loadHistory } = useSleeper();
    const { league, rosters, users, players, loading, error } = useLeagueData(leagueId);
    const [activeTab, setActiveTab] = useState('lineup');

    useEffect(() => {
        if (leagueId && user?.user_id) {
            loadHistory(leagueId, user.user_id);
        }
    }, [leagueId, user, loadHistory]);

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

            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-slate-700 mb-8">
                <button
                    onClick={() => setActiveTab('lineup')}
                    className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'lineup' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Lineup Checker
                    </div>
                    {activeTab === 'lineup' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'analytics' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" />
                        Analytics
                    </div>
                    {activeTab === 'analytics' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'tools' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Tools
                    </div>
                    {activeTab === 'tools' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t-full" />
                    )}
                </button>
            </div>

            {activeTab === 'lineup' ? (
                <LineupChecker leagueId={leagueId} />
            ) : activeTab === 'analytics' ? (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <TrueStandings
                            leagueId={leagueId}
                            currentWeek={league?.settings?.leg || 1}
                            rosters={rosters}
                            users={users}
                        />
                        <TeamRadar
                            leagueId={leagueId}
                            currentWeek={league?.settings?.leg || 1}
                            rosters={rosters}
                            players={players}
                            userRosterId={rosters?.find(r => r.owner_id === user?.user_id)?.roster_id}
                        />
                    </div>
                    <RivalryMatrix currentUserId={user?.user_id} />
                </div>
            ) : (
                <div className="space-y-8">
                    <TradeFinder
                        leagueId={leagueId}
                        currentWeek={league?.settings?.leg || 1}
                        rosters={rosters}
                        users={users}
                        players={players}
                    />
                    <DraftAnalysis
                        league={league}
                        currentWeek={league?.settings?.leg || 1}
                        players={players}
                    />
                </div>
            )}
        </div>
    );
};

export default LeagueView;
