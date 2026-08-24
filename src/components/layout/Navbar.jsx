import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSleeper } from '../../context/SleeperContext';
import { Trophy, User, BarChart2, History, Wrench, Users, Menu, X, LayoutDashboard, Flame, Swords, Crown, Sun, Moon } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
    const { user, leagues, leagueHistory, getLeagues, season } = useSleeper();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Robustly extract leagueId from URL regardless of route nesting
    const leagueIdMatch = location.pathname.match(/\/league\/(\d+)/);
    const leagueId = leagueIdMatch ? leagueIdMatch[1] : null;

    const hasHistory = Array.isArray(leagueHistory) && leagueHistory.length > 1;
    const currentSeasonLeagueId = hasHistory ? leagueHistory[0]?.league_id : null;
    const isHistoricalView = hasHistory && currentSeasonLeagueId && leagueId !== currentSeasonLeagueId;

    const handleSeasonSwitch = (e) => {
        const nextLeagueId = e.target.value;
        if (!nextLeagueId || nextLeagueId === leagueId) return;
        // Preserve tab where safe; degrade to dashboard for season-scoped tail params (team/:rosterId).
        let tail = location.pathname.replace(/^\/league\/[^/]+/, '');
        if (/^\/team\/\d+/.test(tail)) tail = '';
        navigate(`/league/${nextLeagueId}${tail || ''}`);
        setIsMobileMenuOpen(false);
    };

    useEffect(() => {
        // Wait for the NFL state season to resolve so a restored user isn't
        // fetched against a stale/guessed season.
        if (user && season && leagues.length === 0) {
            getLeagues(user.user_id);
        }
    }, [user, season, leagues.length, getLeagues]);

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
            {/* Wider than the page content on large screens: max-w-7xl caps at
                1280px regardless of viewport, so on a 1600px+ display the tabs
                were being squeezed out while hundreds of pixels sat unused. */}
            <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center gap-3 h-16">
                    <div className="flex items-center gap-5 lg:gap-7 min-w-0">
                        <Link
                            to={leagueId ? `/league/${leagueId}` : "/"}
                            className="flex items-center gap-2 group shrink-0"
                        >
                            <Trophy className="h-6 w-6 text-signal group-hover:text-signal/80 transition-colors duration-fast flex-shrink-0" />
                            {/* Icon-only below xl: the wordmark costs ~145px, which is
                                the difference between all eight tabs fitting and the
                                last two spilling into the scroll region. */}
                            <span className="hidden xl:inline font-display text-xl font-bold tracking-snug whitespace-nowrap text-text">
                                League Analysis
                            </span>
                            <span className="sr-only">League Analysis</span>
                        </Link>

                        {leagueId && (
                            // min-w-0 + scroll: without them the nowrap tabs refuse to
                            // shrink and the opaque selectors paint over the last tabs.
                            <div className="hidden md:flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
                                {navItems.map((item) => {
                                    const active = isActive(item.exact ? '' : item.href.split('/').pop());
                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            className={cn(
                                                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-bg transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2",
                                                "h-9 px-2 xl:px-2.5",
                                                active
                                                    ? "bg-bg-3 text-signal"
                                                    : "text-text-dim hover:bg-bg-2 hover:text-text"
                                            )}
                                            aria-current={active ? "page" : undefined}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                        {user && (
                            <div className="hidden md:flex items-center gap-2 lg:gap-3 min-w-0">
                                {/* League Switcher — hidden when only one league */}
                                {leagues.length > 1 && (
                                    <select
                                        value={leagueId || ''}
                                        onChange={handleLeagueSwitch}
                                        title="Switch league"
                                        aria-label="Switch league"
                                        className="bg-bg-2 text-text text-xs rounded-md border border-line focus:ring-1 focus:ring-signal focus:border-signal px-2 py-1.5 transition-colors duration-fast max-w-[120px] lg:max-w-[140px] truncate shrink"
                                    >
                                        <option value="" disabled>League</option>
                                        {leagues.map((league) => (
                                            <option key={league.league_id} value={league.league_id}>
                                                {league.name}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* Season Switcher */}
                                {hasHistory && (
                                    <select
                                        value={leagueId || ''}
                                        onChange={handleSeasonSwitch}
                                        title="Switch season"
                                        aria-label="Switch season"
                                        className={cn(
                                            "bg-bg-2 text-xs rounded-md border focus:ring-1 focus:ring-signal focus:border-signal px-2 py-1.5 transition-colors duration-fast max-w-[120px] truncate shrink",
                                            isHistoricalView ? "border-warn/40 text-warn" : "border-line text-text"
                                        )}
                                    >
                                        {leagueHistory.map((l, i) => (
                                            <option key={l.league_id} value={l.league_id}>
                                                {i === 0 ? `Current · ${l.season}` : l.season}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* Revealed at 2xl, not xl: at xl the container stops
                                    growing (max-w-7xl) while these add ~250px, which is
                                    what pushed the nav tabs under the dropdowns. */}
                                {isHistoricalView && (
                                    <span className="hidden 2xl:inline-flex items-center font-mono text-2xs uppercase tracking-wider font-bold text-warn bg-warn/10 border border-warn/30 rounded-sm px-2 py-0.5 shrink-0">
                                        Historical
                                    </span>
                                )}

                                <div className="flex items-center gap-2 pl-1 shrink-0">
                                    <div className="hidden 2xl:block text-right leading-tight">
                                        <p className="text-sm font-semibold text-text">{user.display_name}</p>
                                        <p className="font-mono text-2xs text-text-mute mt-0.5">@{user.username}</p>
                                    </div>
                                    {user.avatar ? (
                                        <img
                                            src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                            alt={user.username}
                                            title={`@${user.username}`}
                                            className="h-9 w-9 rounded-full ring-1 ring-line"
                                        />
                                    ) : (
                                        <div className="h-9 w-9 rounded-full bg-bg-2 flex items-center justify-center ring-1 ring-line" title={`@${user.username}`}>
                                            <User className="h-5 w-5 text-text-dim" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Theme toggle (visible at all breakpoints) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            className="min-w-[44px] min-h-[44px] text-text-dim hover:text-text hover:bg-bg-2"
                            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </Button>

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

                            {hasHistory && (
                                <div className="px-3 mt-3">
                                    <label className="block font-mono text-2xs text-text-mute uppercase tracking-wider mb-1">
                                        Season {isHistoricalView && <span className="ml-2 text-warn">· Historical</span>}
                                    </label>
                                    <select
                                        value={leagueId || ''}
                                        onChange={handleSeasonSwitch}
                                        className={cn(
                                            "bg-bg-2 text-sm rounded-md border focus:ring-1 focus:ring-signal focus:border-signal block w-full px-3 py-2.5 transition-colors duration-fast",
                                            isHistoricalView ? "border-warn/40 text-warn" : "border-line text-text"
                                        )}
                                    >
                                        {leagueHistory.map((l, i) => (
                                            <option key={l.league_id} value={l.league_id}>
                                                {i === 0 ? `Current · ${l.season}` : l.season}
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
