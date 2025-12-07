import { useOutletContext, useParams } from 'react-router-dom';
import TradeFinder from '../features/tools/components/TradeFinder';

const ToolsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, currentWeek, tradedPicks } = useOutletContext();

    return (
        <div className="space-y-8">
            <TradeFinder
                leagueId={leagueId}
                currentWeek={currentWeek}
                rosters={rosters}
                users={users}
                players={players}
                league={league}
                tradedPicks={tradedPicks}
            />
        </div>
    );
};

export default ToolsPage;
