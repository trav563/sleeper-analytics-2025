import { useOutletContext } from 'react-router-dom';
import LeagueRecordBook from '../features/history/components/LeagueRecordBook';
import GMPerformance from '../features/history/components/GMPerformance';

const HistoryPage = () => {
    const { users, league, rosters, players, currentWeek, state } = useOutletContext();

    return (
        <div className="space-y-12">
            <LeagueRecordBook users={users} state={state} leagueId={league.league_id} />

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
