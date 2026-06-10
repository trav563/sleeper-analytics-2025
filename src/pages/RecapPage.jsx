import { useOutletContext } from 'react-router-dom';
import WeeklyRecap from '../features/recap/components/WeeklyRecap';
import { Card, CardContent } from '../components/ui/Card';
import { CalendarClock, ArrowRight } from 'lucide-react';

const RecapPage = () => {
    const { league, rosters, users, players, currentWeek } = useOutletContext();

    const isOffseason = !currentWeek || currentWeek === 0 || league?.status === 'pre_draft';

    if (isOffseason) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                <Card className="bg-slate-900/80 border-slate-700 max-w-lg text-center backdrop-blur-sm">
                    <CardContent className="pt-10 pb-10 px-8 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20 mb-2">
                            <CalendarClock className="w-8 h-8 text-orange-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">The {league?.season} Offseason is Here</h2>
                        <p className="text-slate-400">
                            The AI can't roast your terrible lineup decisions until the {league?.season} season actually begins. Nice try dodging the smoke.
                        </p>
                        {league?.previous_league_id && (
                            <a 
                                href={`/league/${league.previous_league_id}/recap`}
                                className="mt-4 flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-lg shadow-orange-900/20"
                            >
                                View {parseInt(league.season) - 1} Roasts <ArrowRight className="w-4 h-4" />
                            </a>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            <WeeklyRecap
                league={league}
                rosters={rosters}
                users={users}
                players={players}
                currentWeek={currentWeek}
            />
        </div>
    );
};

export default RecapPage;
