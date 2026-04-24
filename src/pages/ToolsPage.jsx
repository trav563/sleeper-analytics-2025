import { useOutletContext, useParams } from 'react-router-dom';
import TradeSimulator from '../features/tools/components/TradeSimulator';
import TradeFinder from '../features/tools/components/TradeFinder';
import TankTracker from '../features/tools/components/TankTracker';
import DynastyLandscape from '../features/tools/components/DynastyLandscape';
import RosterClogger from '../features/tools/components/RosterClogger';
import ScheduleGenerator from '../features/tools/components/ScheduleGenerator';
import HistoricalBanner from '../components/layout/HistoricalBanner';

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

    const isHistoricalSeason = league?.season && state?.season &&
        Number(league.season) < Number(state.season);

    return (
        <div className="space-y-6">
            <HistoricalBanner message="These tools are forward-looking and assume the active season." />
            <ScheduleGenerator
                league={league}
                rosters={rosters}
                users={users}
            />

            {!isHistoricalSeason && (
                <TradeSimulator
                    league={league}
                    rosters={rosters}
                    users={users}
                    players={players}
                    currentWeek={currentWeek}
                />
            )}

            <DynastyLandscape
                rosters={rosters}
                users={users}
                players={players}
                league={league}
                state={state}
            />

            {!isHistoricalSeason && (
                <RosterClogger
                    rosters={rosters}
                    players={players}
                    league={league}
                    state={state}
                />
            )}

            <TankTracker
                rosters={rosters}
                users={users}
                tradedPicks={tradedPicks}
                league={league}
            />

            {!isHistoricalSeason && (
                <TradeFinder
                    leagueId={leagueId}
                    currentWeek={currentWeek}
                    rosters={rosters}
                    users={users}
                    players={players}
                    league={league}
                    tradedPicks={tradedPicks}
                />
            )}
        </div>
    );
};

export default ToolsPage;
