import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSleeper } from '../../../context/SleeperContext';
import { Search, ChevronRight, User, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
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
        <div className="min-h-screen flex items-center justify-center bg-background px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 animate-fade-in">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
                        League Analysis
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Find your league and check your lineup
                    </p>
                </div>

                <Card className="border-border/50 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-center text-lg">
                            {!showLeagues ? 'Search User' : 'Select League'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!showLeagues ? (
                            <form className="space-y-6" onSubmit={handleSearch}>
                                <div>
                                    <label htmlFor="username" className="block text-sm font-medium text-muted-foreground mb-1">
                                        Sleeper Username
                                    </label>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                        </div>
                                        <input
                                            type="text"
                                            name="username"
                                            id="username"
                                            className="block w-full pl-10 sm:text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-input py-2"
                                            placeholder="username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="animate-spin -ml-1 mr-3 h-4 w-4" />
                                                Searching...
                                            </>
                                        ) : (
                                            <>
                                                Search <Search className="ml-2 h-4 w-4" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg border border-border">
                                    <img
                                        src={`https://sleepercdn.com/avatars/thumbs/${user?.avatar}`}
                                        alt={user?.username}
                                        className="h-12 w-12 rounded-full border border-border shadow-sm"
                                    />
                                    <div>
                                        <h3 className="text-lg font-medium text-foreground">{user?.display_name}</h3>
                                        <button
                                            onClick={() => setShowLeagues(false)}
                                            className="text-xs text-primary hover:underline hover:text-primary/80 transition-colors"
                                        >
                                            Change user
                                        </button>
                                    </div>
                                </div >

                                <div>
                                    <label htmlFor="league" className="block text-sm font-medium text-muted-foreground mb-2">
                                        Select a League ({season || '...'})
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="league"
                                            name="league"
                                            className="block w-full pl-3 pr-10 py-3 text-base border-input focus:outline-none focus:ring-ring sm:text-sm rounded-md bg-background text-foreground cursor-pointer appearance-none border shadow-sm"
                                            onChange={handleLeagueChange}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Choose a league...</option>
                                            {leagues.map((league) => (
                                                <option key={league.league_id} value={league.league_id}>
                                                    {league.name} ({league.total_rosters} Teams)
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                                            <ChevronRight className="h-4 w-4 rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                {
                                    leagues.length === 0 && (
                                        <p className="text-center text-sm text-muted-foreground">
                                            No leagues found for the {season} season.
                                        </p>
                                    )
                                }
                            </div >
                        )}

                        {
                            error && (
                                <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                    <div className="flex items-center mb-2">
                                        <span className="mr-2">⚠️</span> {error}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowLeagues(false);
                                            setUsername('');
                                        }}
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )
                        }
                    </CardContent>
                </Card>
            </div >
        </div >
    );
};

export default UserSearch;
