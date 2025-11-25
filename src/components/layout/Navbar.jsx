import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSleeper } from '../../context/SleeperContext';
import { avatarUrl } from '../../utils/nflData';
import { Trophy, User, BarChart2, History, Wrench, Users, Menu, X, LayoutDashboard } from 'lucide-react';

const Navbar = () => {
    const { user, leagues, getLeagues } = useSleeper();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Robustly extract leagueId from URL regardless of route nesting
    const leagueIdMatch = location.pathname.match(/\/league\/(\d+)/);
    const leagueId = leagueIdMatch ? leagueIdMatch[1] : null;

    useEffect(() => {
        if (user && leagues.length === 0) {
            getLeagues(user.user_id);
        }
    }, [user, leagues.length, getLeagues]);

    // Close mobile menu when location changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    const isActive = (path) => {
        if (path === '') return location.pathname === `/league/${leagueId}`;
        return location.pathname.includes(path);
    };

    const handleLeagueSwitch = (e) => {
        const newLeagueId = e.target.value;
        if (newLeagueId) {
            navigate(`/league/${newLeagueId}`);
            setIsMobileMenuOpen(false);
        }
    };

    return (
        <nav className="bg-slate-800 border-b border-slate-700 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link to={leagueId ? `/league/${leagueId}` : "/"} className="flex items-center space-x-2 group">
                            <Trophy className="h-6 w-6 text-blue-500 group-hover:text-blue-400 transition-colors" />
                            <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                Dynasty Lens
                            </span>
                        </Link>

                        {leagueId && (
                            <div className="hidden md:flex items-center gap-1">
                                <Link
                                    to={`/league/${leagueId}`}
                                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${isActive('') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    <LayoutDashboard className="w-4 h-4" />
                                    Dashboard
                                </Link>
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

                    <div className="flex items-center gap-4">
                        {user && (
                            <div className="hidden md:flex items-center space-x-6">
                                {/* League Switcher */}
                                {leagues.length > 0 && (
                                    <div className="hidden sm:block">
                                        <select
                                            value={leagueId || ''}
                                            onChange={handleLeagueSwitch}
                                            className="bg-slate-700 text-white text-sm rounded-lg border-slate-600 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        >
                                            <option value="" disabled>Switch League</option>
                                            {leagues.map((league) => (
                                                <option key={league.league_id} value={league.league_id}>
                                                    {league.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

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
                            </div>
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none"
                        >
                            {isMobileMenuOpen ? (
                                <X className="h-6 w-6" />
                            ) : (
                                <Menu className="h-6 w-6" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-slate-800 border-t border-slate-700 px-2 pt-2 pb-3 space-y-1 shadow-lg animate-fade-in">
                    {leagueId && (
                        <>
                            <Link
                                to={`/league/${leagueId}`}
                                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2 ${isActive('') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                            >
                                <LayoutDashboard className="w-5 h-5" />
                                Dashboard
                            </Link>
                            <Link
                                to={`/league/${leagueId}/lineup`}
                                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2 ${isActive('lineup') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                            >
                                <Users className="w-5 h-5" />
                                Lineup
                            </Link>
                            <Link
                                to={`/league/${leagueId}/analytics`}
                                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2 ${isActive('analytics') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                            >
                                <BarChart2 className="w-5 h-5" />
                                Analytics
                            </Link>
                            <Link
                                to={`/league/${leagueId}/history`}
                                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2 ${isActive('history') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                            >
                                <History className="w-5 h-5" />
                                History
                            </Link>
                            <Link
                                to={`/league/${leagueId}/tools`}
                                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2 ${isActive('tools') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                            >
                                <Wrench className="w-5 h-5" />
                                Tools
                            </Link>
                        </>
                    )}

                    {user && (
                        <div className="pt-4 pb-3 border-t border-slate-700">
                            <div className="flex items-center px-3 mb-3">
                                <div className="flex-shrink-0">
                                    {user.avatar ? (
                                        <img
                                            src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                            alt={user.username}
                                            className="h-10 w-10 rounded-full border-2 border-blue-500"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600">
                                            <User className="h-6 w-6 text-slate-400" />
                                        </div>
                                    )}
                                </div>
                                <div className="ml-3">
                                    <div className="text-base font-medium leading-none text-white">{user.display_name}</div>
                                    <div className="text-sm font-medium leading-none text-slate-400 mt-1">@{user.username}</div>
                                </div>
                            </div>

                            {leagues.length > 0 && (
                                <div className="px-3">
                                    <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Switch League</label>
                                    <select
                                        value={leagueId || ''}
                                        onChange={handleLeagueSwitch}
                                        className="bg-slate-700 text-white text-sm rounded-lg border-slate-600 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                    >
                                        <option value="" disabled>Select League</option>
                                        {leagues.map((league) => (
                                            <option key={league.league_id} value={league.league_id}>
                                                {league.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
