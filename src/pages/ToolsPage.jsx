import { useOutletContext, useParams } from 'react-router-dom';
import TradeFinder from '../features/tools/components/TradeFinder';
import TankTracker from '../features/tools/components/TankTracker';
import DynastyLandscape from '../features/tools/components/DynastyLandscape';
import RosterClogger from '../features/tools/components/RosterClogger';
import TradeCalculator from '../features/tools/components/TradeCalculator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { TrendingUp, ArrowLeftRight, Users } from 'lucide-react';

const ToolsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, currentWeek, tradedPicks, state } = useOutletContext();

    // Comprehensive Loading Guard
    if (!league || !league.roster_positions || !rosters || !users || !players) {
        return <div className="p-12 text-center text-slate-500">Loading League Tools...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">League Tools</h1>
                <p className="text-sm text-muted-foreground mt-1">Dynasty analysis, trade tools, and roster insights</p>
            </div>

            <Tabs defaultValue="dynasty" className="w-full">
                <TabsList className="bg-muted/50 border border-border rounded-lg p-1 w-full sm:w-auto flex">
                    <TabsTrigger value="dynasty" className="flex-1 sm:flex-initial gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Dynasty Overview
                    </TabsTrigger>
                    <TabsTrigger value="trades" className="flex-1 sm:flex-initial gap-2">
                        <ArrowLeftRight className="w-4 h-4" />
                        Trade Center
                    </TabsTrigger>
                    <TabsTrigger value="roster" className="flex-1 sm:flex-initial gap-2">
                        <Users className="w-4 h-4" />
                        Roster Analysis
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dynasty" className="mt-6">
                    <DynastyLandscape
                        rosters={rosters}
                        users={users}
                        players={players}
                        league={league}
                        state={state}
                    />
                </TabsContent>

                <TabsContent value="trades" className="mt-6 space-y-8">
                    <TradeCalculator
                        rosters={rosters}
                        users={users}
                        players={players}
                        league={league}
                        state={state}
                        tradedPicks={tradedPicks}
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
                </TabsContent>

                <TabsContent value="roster" className="mt-6 space-y-8">
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
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ToolsPage;

