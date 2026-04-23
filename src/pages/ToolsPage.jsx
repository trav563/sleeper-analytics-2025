import { useOutletContext, useParams } from 'react-router-dom';
import TradeSimulator from '../features/tools/components/TradeSimulator';
import TradeFinder from '../features/tools/components/TradeFinder';
import TankTracker from '../features/tools/components/TankTracker';
import DynastyLandscape from '../features/tools/components/DynastyLandscape';
import RosterClogger from '../features/tools/components/RosterClogger';
import ScheduleGenerator from '../features/tools/components/ScheduleGenerator';

const ToolsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, currentWeek, tradedPicks, state } = useOutletContext();

    // Comprehensive Loading Guard
    // Ensure all critical data (including Arrays) is present before rendering tools
    if (!league || !league.roster_positions || !rosters || !users || !players) {
        return (
            <div className="p-12 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                Loading league tools…
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ScheduleGenerator
                league={league}
                rosters={rosters}
                users={users}
            />

            <TradeSimulator
                league={league}
                rosters={rosters}
                users={users}
                players={players}
                currentWeek={currentWeek}
            />

            <DynastyLandscape
                rosters={rosters}
                users={users}
                players={players}
                league={league}
                state={state}
            />

            <RosterClogger
                rosters={rosters}
                players={players}
                league={league}
                state={state}
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
