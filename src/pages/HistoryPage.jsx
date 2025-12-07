import { useOutletContext } from 'react-router-dom';
import LeagueRecordBook from '../features/history/components/LeagueRecordBook';
import GMPerformance from '../features/history/components/GMPerformance';

const HistoryPage = () => {
    const { user, users, league, rosters, players, currentWeek } = useOutletContext();

    return (
        <div className="space-y-12">
            <LeagueRecordBook users={users} />

            <GMPerformance
                league={league}
                currentWeek={currentWeek}
                players={players}
                users={users}
                rosters={rosters}
            />
        </div>
    );
};

export default HistoryPage;
