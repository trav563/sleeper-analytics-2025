import { useOutletContext, useParams } from 'react-router-dom';
import TradeFinder from '../features/tools/components/TradeFinder';
import DraftAnalysis from '../features/tools/components/DraftAnalysis';

const ToolsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, currentWeek } = useOutletContext();

    return (
        <div className="space-y-8">
            <TradeFinder
                leagueId={leagueId}
                currentWeek={currentWeek}
                rosters={rosters}
                users={users}
                players={players}
                league={league}
            />
            <DraftAnalysis
                league={league}
                currentWeek={currentWeek}
                players={players}
                users={users}
                rosters={rosters}
            />
        </div>
    );
};

export default ToolsPage;
