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
            />
            <DraftAnalysis
                league={league}
                currentWeek={currentWeek}
                players={players}
            />
        </div>
    );
};

export default ToolsPage;
