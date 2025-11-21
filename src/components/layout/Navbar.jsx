import { Link, useLocation } from 'react-router-dom';
import { useSleeper } from '../../context/SleeperContext';
import { avatarUrl } from '../../utils/nflData';
import { Trophy, User, BarChart2, History, Wrench, Users } from 'lucide-react';

const Navbar = () => {
    const { user } = useSleeper();
    const location = useLocation();

    // Robustly extract leagueId from URL regardless of route nesting
    const leagueIdMatch = location.pathname.match(/\/league\/(\d+)/);
    const leagueId = leagueIdMatch ? leagueIdMatch[1] : null;

    const isActive = (path) => location.pathname.includes(path);

    return (
        <nav className="bg-slate-800 border-b border-slate-700 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center space-x-2 group">
                            <Trophy className="h-6 w-6 text-blue-500 group-hover:text-blue-400 transition-colors" />
                            <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                Sleeper Analytics
                            </span>
                        </Link>

                        {leagueId && (
                            <div className="hidden md:flex items-center gap-1">
                                <Link
                                    to={`/league/${leagueId}/lineup`}
                                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${isActive('lineup') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    <Users className="w-4 h-4" />
                                    Lineup
                                </Link>
                                <Link
                                    to={`/league/${leagueId}/analytics`}
                                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${isActive('analytics') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    <BarChart2 className="w-4 h-4" />
                                    Analytics
                                </Link>
                                <Link
                                    to={`/league/${leagueId}/history`}
                                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${isActive('history') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    <History className="w-4 h-4" />
                                    History
                                </Link>
                                <Link
                                    to={`/league/${leagueId}/tools`}
                                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${isActive('tools') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    <Wrench className="w-4 h-4" />
                                    Tools
                                </Link>
                            </div>
                        )}
                    </div>

                    {user && (
                        <div className="flex items-center space-x-3">
                            <div className="hidden sm:block text-right">
                                <p className="text-sm font-medium text-white">{user.display_name}</p>
                                <p className="text-xs text-slate-400">@{user.username}</p>
                            </div>
                            {user.avatar ? (
                                <img
                                    src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                    alt={user.username}
                                    className="h-10 w-10 rounded-full border-2 border-blue-500 shadow-md hover:border-blue-400 transition-colors"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600">
                                    <User className="h-6 w-6 text-slate-400" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
