import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSleeper } from '../../context/SleeperContext';
import { Trophy, User, BarChart2, History, Wrench, Users, Menu, X, LayoutDashboard, Flame, Swords, Crown } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

    const navItems = [
        { href: `/league/${leagueId}`, label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { href: `/league/${leagueId}/matchup`, label: 'Matchup', icon: Swords },
        { href: `/league/${leagueId}/lineup`, label: 'Lineup', icon: Users },
        { href: `/league/${leagueId}/standings`, label: 'Standings', icon: Crown },
        { href: `/league/${leagueId}/analytics`, label: 'Analytics', icon: BarChart2 },
        { href: `/league/${leagueId}/recap`, label: 'The Roast', icon: Flame },
        { href: `/league/${leagueId}/history`, label: 'History', icon: History },
        { href: `/league/${leagueId}/tools`, label: 'Tools', icon: Wrench },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link
                            to={leagueId ? `/league/${leagueId}` : "/"}
                            className="flex items-center gap-2 group min-w-[180px] shrink-0"
                        >
                            <Trophy className="h-6 w-6 text-signal group-hover:text-signal/80 transition-colors duration-fast flex-shrink-0" />
                            <span className="font-display text-xl font-bold tracking-snug whitespace-nowrap text-text">
                                League Analysis
                            </span>
                        </Link>

                        {leagueId && (
                            <div className="hidden md:flex items-center gap-1">
                                {navItems.map((item) => {
                                    const active = isActive(item.exact ? '' : item.href.split('/').pop());
                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            className={cn(
                                                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-bg transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2",
                                                "h-9 px-3 gap-2",
                                                active
                                                    ? "bg-bg-3 text-signal"
                                                    : "text-text-dim hover:bg-bg-2 hover:text-text"
                                            )}
                                            aria-current={active ? "page" : undefined}
                                        >
                                            <item.icon className="w-4 h-4" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
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
                                            className="bg-bg-2 text-text text-sm rounded-md border border-line focus:ring-1 focus:ring-signal focus:border-signal block w-full px-3 py-2 transition-colors duration-fast"
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

                                <div className="flex items-center gap-3">
                                    <div className="hidden sm:block text-right">
                                        <p className="text-sm font-semibold leading-none text-text">{user.display_name}</p>
                                        <p className="font-mono text-2xs text-text-mute mt-1">@{user.username}</p>
                                    </div>
                                    {user.avatar ? (
                                        <img
                                            src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                            alt={user.username}
                                            className="h-9 w-9 rounded-full ring-1 ring-line"
                                        />
                                    ) : (
                                        <div className="h-9 w-9 rounded-full bg-bg-2 flex items-center justify-center ring-1 ring-line">
                                            <User className="h-5 w-5 text-text-dim" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Mobile Menu Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden min-w-[44px] min-h-[44px] text-text-dim hover:text-text hover:bg-bg-2"
                            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                            aria-expanded={isMobileMenuOpen}
                        >
                            {isMobileMenuOpen ? (
                                <X className="h-6 w-6" />
                            ) : (
                                <Menu className="h-6 w-6" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-line bg-bg/95 backdrop-blur px-2 pt-2 pb-3 space-y-1 animate-accordion-down">
                    {leagueId && navItems.map((item) => {
                        const active = isActive(item.exact ? '' : item.href.split('/').pop());
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "inline-flex items-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-bg transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2",
                                    "min-h-[44px] w-full justify-start gap-2 px-4 py-2",
                                    active
                                        ? "bg-bg-3 text-signal"
                                        : "text-text-dim hover:bg-bg-2 hover:text-text"
                                )}
                                aria-current={active ? "page" : undefined}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}

                    {user && (
                        <div className="pt-4 pb-3 border-t border-line mt-2">
                            <div className="flex items-center px-3 mb-3">
                                <div className="flex-shrink-0">
                                    {user.avatar ? (
                                        <img
                                            src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                            alt={user.username}
                                            className="h-10 w-10 rounded-full ring-1 ring-line"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-bg-2 flex items-center justify-center ring-1 ring-line">
                                            <User className="h-6 w-6 text-text-dim" />
                                        </div>
                                    )}
                                </div>
                                <div className="ml-3">
                                    <div className="text-base font-semibold leading-none text-text">{user.display_name}</div>
                                    <div className="font-mono text-2xs text-text-mute mt-1">@{user.username}</div>
                                </div>
                            </div>

                            {leagues.length > 0 && (
                                <div className="px-3">
                                    <label className="block font-mono text-2xs text-text-mute uppercase tracking-wider mb-1">Switch League</label>
                                    <select
                                        value={leagueId || ''}
                                        onChange={handleLeagueSwitch}
                                        className="bg-bg-2 text-text text-sm rounded-md border border-line focus:ring-1 focus:ring-signal focus:border-signal block w-full px-3 py-2.5 transition-colors duration-fast"
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
