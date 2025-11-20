import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSleeper } from '../context/SleeperContext';
import Dashboard from '../components/Dashboard';

const Home = () => {
    const navigate = useNavigate();
    const { user, leagues, loading, error, fetchLeagueData } = useSleeper();
    const [username, setUsername] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;
        await fetchLeagueData(username);
    };

    const handleLeagueClick = (league) => {
        navigate(`/ league / ${league.league_id} `);
    };

    const handleLogout = () => {
        window.location.reload(); // Simple way to reset state for now
    };

    if (user) {
        return (
            <Dashboard
                user={user}
                leagues={leagues}
                onLeagueClick={handleLeagueClick}
                onLogout={handleLogout}
            />
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-900">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl mb-4">
                    <span className="block">Analyze Your</span>
                    <span className="block text-blue-500">Sleeper Leagues</span>
                </h1>
                <p className="mt-2 text-lg text-slate-400">
                    Enter your Sleeper username to get started.
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-slate-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-700">
                    <form className="space-y-6" onSubmit={handleSearch}>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                                Sleeper Username
                            </label>
                            <div className="mt-1">
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-700 text-white"
                                    placeholder="e.g. sleeperuser"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Loading...' : 'Analyze Leagues'}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="mt-6 p-4 rounded-md bg-red-900/50 border border-red-800 text-red-200 text-sm">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;
