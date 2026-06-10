import { useOutletContext } from 'react-router-dom';
import LeagueRecordBook from '../features/history/components/LeagueRecordBook';
import GMPerformance from '../features/history/components/GMPerformance';
import BiggestFleeces from '../features/history/components/BiggestFleeces';

const HistoryPage = () => {
    const { user, users, league, rosters, players, currentWeek } = useOutletContext();

    return (
        <div className="space-y-12">
            <LeagueRecordBook users={users} />

            <BiggestFleeces 
                leagueId={league.league_id} 
                users={users} 
                players={players} 
                currentWeek={currentWeek}
                league={league}
                rosters={rosters}
            />

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
