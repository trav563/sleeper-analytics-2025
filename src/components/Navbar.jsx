import { Link } from 'react-router-dom';
import { useSleeper } from '../context/SleeperContext';
import { Trophy, User } from 'lucide-react';

const Navbar = () => {
    const { user } = useSleeper();

    return (
        <nav className="bg-slate-800 border-b border-slate-700 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center space-x-2 group">
                        <Trophy className="h-6 w-6 text-blue-500 group-hover:text-blue-400 transition-colors" />
                        <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                            Sleeper Analytics
                        </span>
                    </Link>

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
