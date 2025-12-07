import { useOutletContext, useParams } from 'react-router-dom';
import TradeFinder from '../features/tools/components/TradeFinder';
import TankTracker from '../features/tools/components/TankTracker';
import DynastyLandscape from '../features/tools/components/DynastyLandscape';

const ToolsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, currentWeek, tradedPicks } = useOutletContext();

    return (
        <div className="space-y-8">
            <DynastyLandscape
                rosters={rosters}
                users={users}
                players={players}
                league={league}
            />

            <TankTracker
                rosters={rosters}
                users={users}
                tradedPicks={tradedPicks}
                league={league}
            />

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
