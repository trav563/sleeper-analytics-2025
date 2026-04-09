import { useOutletContext } from 'react-router-dom';
import WeeklyRecap from '../features/recap/components/WeeklyRecap';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';

const RecapPage = () => {
    const { league, rosters, users, players, currentWeek } = useOutletContext();
    const { seasonMatchups, loading: seasonMatchupsLoading } = useSeasonMatchups(league?.league_id, currentWeek);

    return (
        <div className="animate-in fade-in duration-500">
            <WeeklyRecap
                league={league}
                rosters={rosters}
                users={users}
                players={players}
                currentWeek={currentWeek}
                seasonMatchups={seasonMatchups}
                seasonMatchupsLoading={seasonMatchupsLoading}
            />
        </div>
    );
};

export default RecapPage;
