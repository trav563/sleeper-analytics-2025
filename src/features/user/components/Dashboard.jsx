import LeagueCard from '../../league/components/LeagueCard';
import RosterNews from '../../dashboard/components/RosterNews';
import { LayoutDashboard, LogOut } from 'lucide-react';

const Dashboard = ({ user, leagues, onLeagueClick, onLogout }) => {
    if (!user) return null;

    return (
        <div className="min-h-screen bg-bg text-text">
            {/* Dashboard Header */}
            <div className="bg-bg-1 border-b border-line">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img
                                src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                alt={user.username}
                                className="w-16 h-16 rounded-full border-2 border-signal shadow-glow-signal"
                            />
                            <div>
                                <h1 className="text-2xl font-bold text-text flex items-center gap-2">
                                    {user.display_name}
                                    <span className="px-2 py-0.5 rounded-full bg-signal/10 text-signal text-xs font-medium border border-signal/20">
                                        User
                                    </span>
                                </h1>
                                <p className="text-text-dim text-sm mt-1">Sleeper ID: {user.user_id}</p>
                            </div>
                        </div>

                        <button
                            onClick={onLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-2 hover:bg-bg-3 text-text-dim transition-colors border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
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
                    <LayoutDashboard className="w-6 h-6 text-signal" />
                    <h2 className="text-xl font-semibold text-text">Your Leagues</h2>
                    <span className="tnum px-2.5 py-0.5 rounded-full bg-bg-2 text-text-dim text-xs font-medium border border-line">
                        {leagues.length}
                    </span>
                </div>

                {leagues.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* News Ticker (Spans full width on mobile, or takes a slot) */}
                        <div className="lg:col-span-3">
                            {/* We pass empty roster for now to show top headlines. 
                                 Future enhancement: Aggregated roster fetching. */}
                            <RosterNews roster={null} players={null} />
                        </div>

                        {leagues.map(league => (
                            <LeagueCard
                                key={league.league_id}
                                league={league}
                                onClick={onLeagueClick}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-bg-1/50 rounded-xl border border-line border-dashed">
                        <p className="text-text-dim">No leagues found for this season.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
