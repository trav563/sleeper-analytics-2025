import { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import TrueStandings from '../features/analytics/components/TrueStandings';
import TeamRadar from '../features/analytics/components/TeamRadar';
import RivalryMatrix from '../features/analytics/components/RivalryMatrix';
import { displayTeamName } from '../utils/nflData';

const AnalyticsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, user, currentWeek } = useOutletContext();

    // Default to current user's roster ID, or the first roster if user not found
    const [selectedRosterId, setSelectedRosterId] = useState(null);
    const [comparisonMode, setComparisonMode] = useState('league'); // 'league' | 'h2h'
    const [opponentRosterId, setOpponentRosterId] = useState(null);

    useEffect(() => {
        if (!rosters || rosters.length === 0) return;

        // If we already have a selection that is valid, don't change it
        if (selectedRosterId && rosters.find(r => r.roster_id === selectedRosterId)) return;

        // Try to match current user
        if (user) {
            const userRoster = rosters.find(r => r.owner_id === user.user_id);
            if (userRoster) {
                setSelectedRosterId(userRoster.roster_id);
                return;
            }
        }

        // Fallback to first roster
        setSelectedRosterId(rosters[0].roster_id);
    }, [rosters, user, selectedRosterId]);

    const handleTeamChange = (e) => {
        setSelectedRosterId(Number(e.target.value));
    };

    const handleOpponentChange = (e) => {
        setOpponentRosterId(Number(e.target.value));
    };

    const selectedUser = users?.find(u => u.user_id === rosters?.find(r => r.roster_id === selectedRosterId)?.owner_id);
    const opponentUser = users?.find(u => u.user_id === rosters?.find(r => r.roster_id === opponentRosterId)?.owner_id);

    return (
        <div className="space-y-8">
            {/* Team Selector Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div>
                    <h2 className="text-lg font-semibold text-white">Team Analysis</h2>
                    <p className="text-sm text-slate-400">Select a team to view their positional strength</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {/* Comparison Mode Toggle */}
                    <div className="flex bg-slate-700 rounded-lg p-1 self-start sm:self-center">
                        <button
                            onClick={() => setComparisonMode('league')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${comparisonMode === 'league' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            vs League
                        </button>
                        <button
                            onClick={() => setComparisonMode('h2h')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${comparisonMode === 'h2h' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Head-to-Head
                        </button>
                    </div>

                    <div className="flex gap-2 items-center w-full sm:w-auto">
                        <select
                            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-48 p-2.5"
                            value={selectedRosterId || ''}
                            onChange={handleTeamChange}
                        >
                            {rosters?.map(roster => {
                                const rosterUser = users?.find(u => u.user_id === roster.owner_id);
                                return (
                                    <option key={roster.roster_id} value={roster.roster_id}>
                                        {displayTeamName(rosterUser)}
                                    </option>
                                );
                            })}
                        </select>

                        {comparisonMode === 'h2h' && (
                            <>
                                <span className="text-slate-400 font-bold">VS</span>
                                <select
                                    className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-48 p-2.5"
                                    value={opponentRosterId || ''}
                                    onChange={handleOpponentChange}
                                >
                                    <option value="" disabled>Select Opponent</option>
                                    {rosters?.filter(r => r.roster_id !== selectedRosterId).map(roster => {
                                        const rosterUser = users?.find(u => u.user_id === roster.owner_id);
                                        return (
                                            <option key={roster.roster_id} value={roster.roster_id}>
                                                {displayTeamName(rosterUser)}
                                            </option>
                                        );
                                    })}
                                </select>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <TrueStandings
                    leagueId={leagueId}
                    currentWeek={currentWeek}
                    rosters={rosters}
                    users={users}
                />
                <TeamRadar
                    leagueId={leagueId}
                    currentWeek={currentWeek}
                    rosters={rosters}
                    players={players}
                    userRosterId={selectedRosterId}
                    opponentRosterId={comparisonMode === 'h2h' ? opponentRosterId : null}
                    opponentTeamName={comparisonMode === 'h2h' ? displayTeamName(opponentUser) : null}
                    users={users}
                />
            </div>

            <RivalryMatrix
                currentUserId={user?.user_id}
                users={users}
                selectedUser1Id={selectedUser?.user_id}
                selectedUser2Id={comparisonMode === 'h2h' ? opponentUser?.user_id : null}
                leagueId={leagueId}
            />
        </div>
    );
};

export default AnalyticsPage;
