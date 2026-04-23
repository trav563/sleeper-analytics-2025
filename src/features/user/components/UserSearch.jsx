import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSleeper } from '../../../context/SleeperContext';
import { Search, ChevronRight, User, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const UserSearch = () => {
    const navigate = useNavigate();
    const { user, leagues, loading, error, searchUser, getLeagues, season } = useSleeper();
    const [username, setUsername] = useState('');
    const [showLeagues, setShowLeagues] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        const userData = await searchUser(username);
        if (userData) {
            await getLeagues(userData.user_id);
            setShowLeagues(true);
        }
    };

    const handleLeagueChange = (e) => {
        const leagueId = e.target.value;
        if (leagueId) {
            navigate(`/league/${leagueId}`);
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-bg px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-6 animate-fade-in">
                <div className="text-center">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        {showLeagues ? 'Step 2 · choose league' : 'Step 1 · find user'}
                    </div>
                    <h2 className="mt-2 font-display text-3xl font-bold tracking-snug text-text">
                        League Analysis
                    </h2>
                    <p className="mt-2 text-sm text-text-dim">
                        Find your league and check your lineup
                    </p>
                </div>

                <Card className="bg-bg-1 border border-line shadow-card rounded-xl">
                    <CardHeader>
                        <CardTitle className="text-center font-display text-md font-semibold text-text">
                            {!showLeagues ? 'Search User' : 'Select League'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!showLeagues ? (
                            <form className="space-y-5" onSubmit={handleSearch}>
                                <div>
                                    <label
                                        htmlFor="username"
                                        className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1.5"
                                    >
                                        Sleeper Username
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-text-mute" aria-hidden="true" />
                                        </div>
                                        <input
                                            type="text"
                                            name="username"
                                            id="username"
                                            className="block w-full min-h-[44px] pl-10 pr-3 text-sm rounded-md bg-bg-2 text-text border border-line placeholder:text-text-mute focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                                            placeholder="username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            autoComplete="username"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full min-h-[44px] bg-signal text-[#0B0C10] font-semibold hover:bg-signal/90 focus-visible:ring-signal disabled:opacity-60"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                            Searching…
                                        </>
                                    ) : (
                                        <>
                                            Search <Search className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="space-y-5">
                                <div className="flex items-center gap-3 p-3 bg-bg-2 rounded-md border border-line">
                                    {user?.avatar ? (
                                        <img
                                            src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                                            alt={user?.username}
                                            className="h-12 w-12 rounded-full ring-1 ring-line"
                                        />
                                    ) : (
                                        <div className="h-12 w-12 rounded-full bg-bg-3 flex items-center justify-center ring-1 ring-line">
                                            <User className="h-6 w-6 text-text-dim" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="text-md font-semibold text-text truncate">{user?.display_name}</h3>
                                        <button
                                            type="button"
                                            onClick={() => setShowLeagues(false)}
                                            className="font-mono text-2xs uppercase tracking-wider text-text-dim hover:text-signal transition-colors duration-fast"
                                        >
                                            ← Change user
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="league"
                                        className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1.5"
                                    >
                                        Select a League <span className="tnum text-text-dim">({season || '…'})</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="league"
                                            name="league"
                                            className="block w-full min-h-[44px] pl-3 pr-10 text-sm rounded-md bg-bg-2 text-text border border-line focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal cursor-pointer appearance-none transition-colors duration-fast"
                                            onChange={handleLeagueChange}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Choose a league…</option>
                                            {leagues.map((league) => (
                                                <option key={league.league_id} value={league.league_id}>
                                                    {league.name} ({league.total_rosters} teams)
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-text-dim">
                                            <ChevronRight className="h-4 w-4 rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                {leagues.length === 0 && (
                                    <p className="text-center text-sm text-text-dim">
                                        No leagues found for the <span className="tnum">{season}</span> season.
                                    </p>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-3 rounded-md bg-bad/10 border border-bad/30 text-bad text-sm flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                                <span>{error}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UserSearch;
