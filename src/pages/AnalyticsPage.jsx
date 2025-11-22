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

    useEffect(() => {
        if (rosters && user && !selectedRosterId) {
            const userRoster = rosters.find(r => r.owner_id === user.user_id);
            if (userRoster) {
                setSelectedRosterId(userRoster.roster_id);
            } else if (rosters.length > 0) {
                setSelectedRosterId(rosters[0].roster_id);
            }
        }
    }, [rosters, user, selectedRosterId]);

    const handleTeamChange = (e) => {
        setSelectedRosterId(Number(e.target.value));
    };

    return (
        <div className="space-y-8">
            {/* Team Selector Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div>
                    <h2 className="text-lg font-semibold text-white">Team Analysis</h2>
                    <p className="text-sm text-slate-400">Select a team to view their positional strength</p>
                </div>
                <select
                    className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-64 p-2.5"
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
                    users={users}
                />
            </div>
            {/* RivalryMatrix handles its own history fetching but needs user ID */}
            <RivalryMatrix currentUserId={user?.user_id} users={users} />
        </div>
    );
};

export default AnalyticsPage;
