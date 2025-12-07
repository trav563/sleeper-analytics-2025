import { useOutletContext } from 'react-router-dom';
import WeeklyRecap from '../features/recap/components/WeeklyRecap';

const RecapPage = () => {
    const { league, rosters, users, players, currentWeek } = useOutletContext();

    return (
        <div className="animate-in fade-in duration-500">
            <WeeklyRecap
                league={league}
                rosters={rosters}
                users={users}
                players={players}
                currentWeek={currentWeek}
            />
        </div>
    );
};

export default RecapPage;
