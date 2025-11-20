import { useNavigate, useParams } from 'react-router-dom';
import LineupChecker from '../components/LineupChecker';

const LeagueView = () => {
    const { leagueId } = useParams();
    const navigate = useNavigate();

    const handleLeagueChange = (e) => {
        if (e.key === "Enter") {
            navigate(`/league/${e.target.value.trim()}`);
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">League Analysis</h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        League ID: {leagueId}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        className="px-3 sm:px-4 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm w-full sm:w-64"
                        placeholder="Enter League ID"
                        defaultValue={leagueId}
                        onKeyDown={handleLeagueChange}
                    />
                    <button
                        className="px-3 sm:px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-blue-500 active:bg-blue-700 flex-shrink-0"
                        onClick={() => {
                            const el = document.querySelector("input[placeholder='Enter League ID']");
                            if (el?.value) navigate(`/league/${el.value.trim()}`);
                        }}
                    >
                        Load
                    </button>
                </div>
            </header>

            <LineupChecker leagueId={leagueId} />
        </div>
    );
};

export default LeagueView;

