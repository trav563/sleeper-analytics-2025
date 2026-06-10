import { useOutletContext } from 'react-router-dom';
import DraftCapital from '../features/draft/components/DraftCapital';
import LiveDraftAssistant from '../features/draft/components/LiveDraftAssistant';

const DraftPage = () => {
    // Extract everything we might need from LeagueLayout context
    const { league, rosters, users, user, players, state, tradedPicks } = useOutletContext();

    if (!league || !rosters || !users) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    Draft Hub
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30">
                        NEW
                    </span>
                </h1>
                <p className="text-slate-400">
                    Analyze future draft capital, map out rebuilds, and view power rankings of upcoming draft classes.
                </p>
            </div>

            {/* Live Draft Assistant — auto-hides when no active/recent draft */}
            <LiveDraftAssistant
                league={league}
                rosters={rosters}
                users={users}
                user={user}
                players={players}
                state={state}
            />

            <div className="grid grid-cols-1 gap-8">
                <DraftCapital 
                    league={league}
                    rosters={rosters}
                    users={users}
                    state={state}
                    tradedPicks={tradedPicks}
                />
            </div>
        </div>
    );
};

export default DraftPage;

