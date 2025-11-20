import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSleeper } from '../context/SleeperContext';
import { Search, ChevronRight, User } from 'lucide-react';

const UserSearch = () => {
    const navigate = useNavigate();
    const { user, leagues, loading, error, searchUser, getLeagues } = useSleeper();
    const [username, setUsername] = useState('');
    const [showLeagues, setShowLeagues] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        const userData = await searchUser(username);
        if (userData) {
            await getLeagues(userData.user_id, '2024');
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
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-white">
                        Sleeper Analytics
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Find your league and check your lineup
                    </p>
                </div>

                <div className="bg-slate-800 py-8 px-4 shadow-xl rounded-xl border border-slate-700 sm:px-10">
                    {!showLeagues ? (
                        <form className="space-y-6" onSubmit={handleSearch}>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                                    Sleeper Username
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-slate-400" aria-hidden="true" />
                                    </div>
                                    <input
                                        type="text"
                                        name="username"
                                        id="username"
                                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-600 rounded-md bg-slate-700 text-white placeholder-slate-400 py-3"
                                        placeholder="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Searching...
                                        </span>
                                    ) : (
                                        <span className="flex items-center">
                                            Search <Search className="ml-2 h-4 w-4" />
                                        </span>
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center space-x-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                                <img
                                    src={`https://sleepercdn.com/avatars/thumbs/${user?.avatar}`}
                                    alt={user?.username}
                                    className="h-12 w-12 rounded-full border-2 border-blue-500"
                                />
                                <div>
                                    <h3 className="text-lg font-medium text-white">{user?.display_name}</h3>
                                    <button
                                        onClick={() => setShowLeagues(false)}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        Change user
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="league" className="block text-sm font-medium text-slate-300 mb-2">
                                    Select a League ({useSleeper().season || '...'})
                                </label>
                                <div className="relative">
                                    <select
                                        id="league"
                                        name="league"
                                        className="block w-full pl-3 pr-10 py-3 text-base border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-700 text-white appearance-none cursor-pointer"
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
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                        <ChevronRight className="h-5 w-5 rotate-90" />
                                    </div>
                                </div>
                            </div>

                            {leagues.length === 0 && (
                                <p className="text-center text-sm text-slate-400">
                                    No leagues found for the 2024 season.
                                </p>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 rounded-md bg-red-900/50 border border-red-800 text-red-200 text-sm flex items-center">
                            <span className="mr-2">⚠️</span> {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserSearch;
