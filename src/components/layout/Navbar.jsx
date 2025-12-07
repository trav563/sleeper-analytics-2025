import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSleeper } from '../../context/SleeperContext';
import { Trophy, User, BarChart2, History, Wrench, Users, Menu, X, LayoutDashboard, Flame } from 'lucide-react';
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
        { href: `/league/${leagueId}/lineup`, label: 'Lineup', icon: Users },
        { href: `/league/${leagueId}/analytics`, label: 'Analytics', icon: BarChart2 },
        { href: `/league/${leagueId}/recap`, label: 'The Roast', icon: Flame },
        { href: `/league/${leagueId}/history`, label: 'History', icon: History },
        { href: `/league/${leagueId}/tools`, label: 'Tools', icon: Wrench },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link to={leagueId ? `/league/${leagueId}` : "/"} className="flex items-center space-x-2 group min-w-[180px] shrink-0">
                            <Trophy className="h-6 w-6 text-primary group-hover:text-primary/80 transition-colors flex-shrink-0" />
                            <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent whitespace-nowrap">
                                Dynasty Lens
                            </span>
                        </Link>

                        {leagueId && (
                            <div className="hidden md:flex items-center gap-1">
                                {navItems.map((item) => (
                                    <Button
                                        key={item.href}
                                        variant="ghost"
                                        size="sm"
                                        asChild
                                        className={cn(
                                            "gap-2 text-muted-foreground hover:text-primary",
                                            isActive(item.exact ? '' : item.href.split('/').pop()) && "bg-accent text-accent-foreground"
                                        )}
                                    >
                                        <Link to={item.href}>
                                            <item.icon className="w-4 h-4" />
                                            {item.label}
                                        </Link>
                                    </Button>
                                ))}
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
                                            className="bg-muted text-sm rounded-lg border-input focus:ring-ring focus:border-ring block w-full p-2.5"
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
                                        <p className="text-sm font-medium leading-none">{user.display_name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">@{user.username}</p>
                                    </div>
                                    {user.avatar ? (
                                        <img
                                            src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                            alt={user.username}
                                            className="h-9 w-9 rounded-full border border-border shadow-sm"
                                        />
                                    ) : (
                                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border border-border">
                                            <User className="h-5 w-5 text-muted-foreground" />
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
                            className="md:hidden"
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
                <div className="md:hidden border-t border-border bg-background/95 backdrop-blur px-2 pt-2 pb-3 space-y-1 animate-accordion-down">
                    {leagueId && navItems.map((item) => (
                        <Button
                            key={item.href}
                            variant="ghost"
                            asChild
                            className={cn(
                                "w-full justify-start gap-2",
                                isActive(item.exact ? '' : item.href.split('/').pop()) && "bg-accent text-accent-foreground"
                            )}
                        >
                            <Link to={item.href}>
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        </Button>
                    ))}

                    {user && (
                        <div className="pt-4 pb-3 border-t border-border mt-2">
                            <div className="flex items-center px-3 mb-3">
                                <div className="flex-shrink-0">
                                    {user.avatar ? (
                                        <img
                                            src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                            alt={user.username}
                                            className="h-10 w-10 rounded-full border border-border"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border">
                                            <User className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="ml-3">
                                    <div className="text-base font-medium leading-none">{user.display_name}</div>
                                    <div className="text-sm font-medium leading-none text-muted-foreground mt-1">@{user.username}</div>
                                </div>
                            </div>

                            {leagues.length > 0 && (
                                <div className="px-3">
                                    <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1">Switch League</label>
                                    <select
                                        value={leagueId || ''}
                                        onChange={handleLeagueSwitch}
                                        className="bg-muted text-sm rounded-lg border-input focus:ring-ring focus:border-ring block w-full p-2.5"
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
