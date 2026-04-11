import { useMemo, useState, useEffect } from 'react';
import { displayTeamName } from '../../../utils/nflData';
import { getGameStatuses, getGameWeather } from '../../../services/nflSchedule';
import { calculateProjectedScore } from '../../../utils/scoreProjections';
import { Info, CloudRain } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '../../../components/ui/Card';

const WidgetMatchupPreview = ({ week, currentNFLWeek, users, rosters, matchups, selectedUserId, players, seasonMatchups }) => {
    const [gameStatuses, setGameStatuses] = useState({});
    const [weather, setWeather] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            const [statuses, weatherData] = await Promise.all([
                getGameStatuses(week),
                getGameWeather(week).catch(() => ({})),
            ]);
            setGameStatuses(statuses);
            setWeather(weatherData || {});
        };
        fetchData();
    }, [week]);

    const matchupData = useMemo(() => {
        if (!selectedUserId || !Array.isArray(matchups) || !Array.isArray(rosters)) return null;

        const userRoster = rosters.find(r => r.owner_id === selectedUserId);
        if (!userRoster) return null;

        const userMatchup = matchups.find(m => m.roster_id === userRoster.roster_id);
        if (!userMatchup) return null;

        const opponentMatchup = matchups.find(m => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRoster.roster_id);
        const opponentRoster = opponentMatchup ? rosters.find(r => r.roster_id === opponentMatchup.roster_id) : null;
        const opponentUser = opponentRoster ? users.find(u => u.user_id === opponentRoster.owner_id) : null;

        const userScore = userMatchup.points || 0;
        const opponentScore = opponentMatchup?.points || 0;

        const useProjections = week > currentNFLWeek || (week === currentNFLWeek && userScore === 0 && opponentScore === 0);

        const userProjected = calculateProjectedScore(userMatchup.starters, seasonMatchups, players);
        const opponentProjected = opponentMatchup ? calculateProjectedScore(opponentMatchup.starters, seasonMatchups, players) : 0;

        const userRemaining = [];
        const opponentRemaining = [];

        if (players && Object.keys(gameStatuses).length > 0) {
            // Logic for remaining players omitted for brevity but assumed similar structure
            // Simplified for this rewriting step to focus on UI
            const userStarters = userMatchup.starters || [];
            userStarters.forEach(playerId => {
                const player = players[playerId];
                if (player && (userMatchup.players_points?.[playerId] || 0) === 0 && gameStatuses[player.team] === 'scheduled') {
                    userRemaining.push(`${player.first_name?.[0]}. ${player.last_name}`);
                }
            });
            const opponentStarters = opponentMatchup?.starters || [];
            opponentStarters.forEach(playerId => {
                const player = players[playerId];
                if (player && (opponentMatchup.players_points?.[playerId] || 0) === 0 && gameStatuses[player.team] === 'scheduled') {
                    opponentRemaining.push(`${player.first_name?.[0]}. ${player.last_name}`);
                }
            });
        }

        return {
            userScore,
            opponentScore,
            userProjected,
            opponentProjected,
            opponentName: displayTeamName(opponentUser),
            userRemaining,
            opponentRemaining,
            useProjections
        };
    }, [week, currentNFLWeek, users, rosters, matchups, selectedUserId, players, gameStatuses, seasonMatchups]);

    if (!matchupData) return null;

    return (
        <Card className="h-full bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2 border-b border-slate-700">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                        Week {week} Matchup
                    </CardTitle>
                    {/* Weather badge for user's team */}
                    {(() => {
                        const userRoster = rosters?.find(r => r.owner_id === selectedUserId);
                        const userStarters = userRoster?.starters || [];
                        const starterTeams = userStarters.map(pid => players?.[pid]?.team).filter(Boolean);
                        const adverseWeather = starterTeams.find(t => weather[t]?.isAdverse && !weather[t]?.isIndoor);
                        if (!adverseWeather) return null;
                        const w = weather[adverseWeather];
                        return (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                                <CloudRain className="w-3 h-3" />
                                {w.displayValue || 'Adverse weather'}
                            </span>
                        );
                    })()}
                </div>
            </CardHeader>
            <CardContent className="pt-6 text-center">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-center">
                        <div className={`text-3xl font-bold ${matchupData.useProjections ? 'text-primary/80' : 'text-white'}`}>
                            {matchupData.useProjections ? matchupData.userProjected.toFixed(2) : matchupData.userScore.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 justify-center">
                            My Score
                            {matchupData.useProjections && (
                                <Info className="w-3 h-3 text-primary cursor-help" />
                            )}
                        </div>
                        {matchupData.useProjections && <div className="text-[10px] text-primary/70 font-medium mt-0.5">Proj (Avg)*</div>}
                    </div>

                    <div className="text-sm font-bold text-slate-500">VS</div>

                    <div className="text-center">
                        <div className={`text-3xl font-bold ${matchupData.useProjections ? 'text-primary/80' : 'text-white'}`}>
                            {matchupData.useProjections ? matchupData.opponentProjected.toFixed(2) : matchupData.opponentScore.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 justify-center">
                            {matchupData.opponentName}
                        </div>
                        {matchupData.useProjections && <div className="text-[10px] text-primary/70 font-medium mt-0.5">Proj (Avg)*</div>}
                    </div>
                </div>

                {(matchupData.userRemaining.length > 0 || matchupData.opponentRemaining.length > 0) && (
                    <div className="space-y-2 mt-4 text-left">
                        {matchupData.userRemaining.length > 0 && (
                            <div className="text-xs text-slate-400">
                                <span className="font-semibold text-slate-300">Yet to Play:</span> {matchupData.userRemaining.join(', ')}
                            </div>
                        )}
                        {matchupData.opponentRemaining.length > 0 && (
                            <div className="text-xs text-orange-400/80">
                                <span className="font-semibold text-orange-400">Opponent Remaining:</span> {matchupData.opponentRemaining.join(', ')}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WidgetMatchupPreview;
