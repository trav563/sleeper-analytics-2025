import { useOutletContext, useParams } from 'react-router-dom';
import TrueStandings from '../features/analytics/components/TrueStandings';
import TeamRadar from '../features/analytics/components/TeamRadar';
import RivalryMatrix from '../features/analytics/components/RivalryMatrix';

const AnalyticsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, user, currentWeek } = useOutletContext();

    return (
        <div className="space-y-8">
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
                    userRosterId={rosters?.find(r => r.owner_id === user?.user_id)?.roster_id}
                />
            </div>
            {/* RivalryMatrix handles its own history fetching but needs user ID */}
            <RivalryMatrix currentUserId={user?.user_id} />
        </div>
    );
};

export default AnalyticsPage;
