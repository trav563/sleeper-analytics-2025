import LeagueCard from './LeagueCard';
import { LayoutDashboard, LogOut } from 'lucide-react';

const Dashboard = ({ user, leagues, onLeagueClick, onLogout }) => {
    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Dashboard Header */}
            <div className="bg-slate-800 border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img
                                src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                alt={user.username}
                                className="w-16 h-16 rounded-full border-2 border-blue-500 shadow-lg shadow-blue-500/20"
                            />
                            <div>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                    {user.display_name}
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                                        User
                                    </span>
                                </h1>
                                <p className="text-slate-400 text-sm mt-1">Sleeper ID: {user.user_id}</p>
                            </div>
                        </div>

                        <button
                            onClick={onLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors border border-slate-600"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Change User</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-3 mb-6">
                    <LayoutDashboard className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-semibold text-white">Your Leagues</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-medium border border-slate-700">
                        {leagues.length}
                    </span>
                </div>

                {leagues.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {leagues.map(league => (
                            <LeagueCard
                                key={league.league_id}
                                league={league}
                                onClick={onLeagueClick}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
                        <p className="text-slate-400">No leagues found for this season.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
