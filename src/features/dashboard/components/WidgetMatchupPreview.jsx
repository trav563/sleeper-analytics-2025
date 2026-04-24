import { useMemo, useState, useEffect } from 'react';
import { displayTeamName } from '../../../utils/nflData';
import { getGameStatuses, getGameWeather } from '../../../services/nflSchedule';
import { calculateProjectedScore } from '../../../utils/scoreProjections';
import { Info, CloudRain } from 'lucide-react';

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
            useProjections,
        };
    }, [week, currentNFLWeek, users, rosters, matchups, selectedUserId, players, gameStatuses, seasonMatchups]);

    if (!matchupData) return null;

    const userValue = matchupData.useProjections ? matchupData.userProjected : matchupData.userScore;
    const oppValue  = matchupData.useProjections ? matchupData.opponentProjected : matchupData.opponentScore;
    const userLeading = userValue > oppValue;
    const oppLeading = oppValue > userValue;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card">
            <header className="flex justify-between items-center px-4 pt-3 pb-2 border-b border-line">
                <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    Week <span className="tnum">{week}</span> Matchup
                </h3>
                {(() => {
                    const userRoster = rosters?.find(r => r.owner_id === selectedUserId);
                    const userStarters = userRoster?.starters || [];
                    const starterTeams = userStarters.map(pid => players?.[pid]?.team).filter(Boolean);
                    const adverseWeather = starterTeams.find(t => weather[t]?.isAdverse && !weather[t]?.isIndoor);
                    if (!adverseWeather) return null;
                    const w = weather[adverseWeather];
                    return (
                        <span className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wider text-warn bg-warn/10 border border-warn/30 px-2 py-0.5 rounded-sm">
                            <CloudRain className="w-3 h-3" />
                            {w.displayValue || 'Adverse'}
                        </span>
                    );
                })()}
            </header>

            <div className="px-4 py-5 text-center">
                <div className="flex justify-between items-center mb-4 gap-3">
                    <div className="text-center flex-1 min-w-0">
                        <div className={`font-display tnum text-3xl font-bold ${userLeading ? 'text-signal' : matchupData.useProjections ? 'text-text-dim' : 'text-text'}`}>
                            {userValue.toFixed(2)}
                        </div>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1 flex items-center gap-1 justify-center">
                            My Score
                            {matchupData.useProjections && <Info className="w-3 h-3 text-text-dim cursor-help" />}
                        </div>
                        {matchupData.useProjections && (
                            <div className="font-mono text-2xs text-text-mute mt-0.5">Proj · Avg</div>
                        )}
                    </div>

                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">VS</div>

                    <div className="text-center flex-1 min-w-0">
                        <div className={`font-display tnum text-3xl font-bold ${oppLeading ? 'text-signal-2' : matchupData.useProjections ? 'text-text-dim' : 'text-text'}`}>
                            {oppValue.toFixed(2)}
                        </div>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1 truncate">
                            {matchupData.opponentName}
                        </div>
                        {matchupData.useProjections && (
                            <div className="font-mono text-2xs text-text-mute mt-0.5">Proj · Avg</div>
                        )}
                    </div>
                </div>

                {(matchupData.userRemaining.length > 0 || matchupData.opponentRemaining.length > 0) && (
                    <div className="space-y-2 mt-4 text-left border-t border-line pt-3">
                        {matchupData.userRemaining.length > 0 && (
                            <div className="text-xs text-text-dim">
                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Yet to play</span>{' '}
                                {matchupData.userRemaining.join(', ')}
                            </div>
                        )}
                        {matchupData.opponentRemaining.length > 0 && (
                            <div className="text-xs text-text-dim">
                                <span className="font-mono text-2xs uppercase tracking-wider text-signal-2">Opponent remaining</span>{' '}
                                {matchupData.opponentRemaining.join(', ')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

export default WidgetMatchupPreview;
