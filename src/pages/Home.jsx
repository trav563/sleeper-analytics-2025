import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUser, fetchUserLeagues } from '../utils/sleeper';

const Home = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userData, setUserData] = useState(null);
    const [leagues, setLeagues] = useState([]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        setLoading(true);
        setError(null);
        setUserData(null);
        setLeagues([]);

        try {
            const data = await fetchUser(username);
            if (data) {
                setUserData(data);
                // Fetch leagues for the user (defaulting to 2024 season for now)
                const userLeagues = await fetchUserLeagues(data.user_id, '2024');
                setLeagues(userLeagues);
            } else {
                setError('User not found');
            }
        } catch (err) {
            setError('Failed to fetch user data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-8">
                <span className="block text-white">Analyze Your</span>
                <span className="block text-blue-400">Sleeper Leagues</span>
            </h1>

            <p className="mt-4 text-lg text-gray-400 mb-10">
                Enter your Sleeper username to get started. We'll fetch your leagues and provide deep insights.
            </p>

            <form onSubmit={handleSearch} className="mt-8 sm:flex justify-center">
                <label htmlFor="username" className="sr-only">
                    Sleeper Username
                </label>
                <input
                    type="text"
                    name="username"
                    id="username"
                    className="block w-full sm:max-w-xs rounded-md border-gray-700 bg-gray-900 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-3"
                    placeholder="Sleeper Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <div className="mt-3 sm:mt-0 sm:ml-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className="block w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Loading...' : 'Analyze'}
                    </button>
                </div>
            </form>

            {error && (
                <div className="mt-6 p-4 rounded-md bg-red-900/50 border border-red-800 text-red-200">
                    {error}
                </div>
            )}

            {userData && (
                <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700 shadow-xl animate-fade-in">
                    <div className="flex items-center justify-center space-x-4 mb-6">
                        <img
                            src={`https://sleepercdn.com/avatars/thumbs/${userData.avatar}`}
                            alt={userData.username}
                            className="w-16 h-16 rounded-full border-2 border-blue-500"
                        />
                        <div className="text-left">
                            <h3 className="text-xl font-bold text-white">{userData.display_name}</h3>
                            <p className="text-gray-400 text-sm">User ID: {userData.user_id}</p>
                        </div>
                    </div>

                    {leagues.length > 0 ? (
                        <div className="text-left">
                            <h4 className="text-lg font-medium text-gray-300 mb-3">Your Leagues (2024)</h4>
                            <div className="grid gap-3">
                                {leagues.map(league => (
                                    <button
                                        key={league.league_id}
                                        onClick={() => navigate(`/league/${league.league_id}`)}
                                        className="w-full text-left p-4 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors flex justify-between items-center group"
                                    >
                                        <span className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                            {league.name}
                                        </span>
                                        <span className="text-gray-400 text-sm">
                                            {league.total_rosters} Teams
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-400">No leagues found for the 2024 season.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Home;
