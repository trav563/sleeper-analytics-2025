import { useMemo, useState, useEffect } from 'react';
import { displayTeamName } from '../../../utils/nflData';
import { getGameStatuses } from '../../../services/nflSchedule';
import { calculateProjectedScore } from '../../../utils/scoreProjections';
import { Info } from 'lucide-react';

const WidgetMatchupPreview = ({ week, users, rosters, matchups, selectedUserId, players, seasonMatchups }) => {
    const [gameStatuses, setGameStatuses] = useState({});

    useEffect(() => {
        const fetchStatuses = async () => {
            const statuses = await getGameStatuses(week);
            setGameStatuses(statuses);
        };
        fetchStatuses();
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

        let userScore = userMatchup.points || 0;
        let opponentScore = opponentMatchup?.points || 0;

        // Calculate Projections if score is 0 (or very low, implying game hasn't started/finished)
        // Ideally we check game status, but checking score === 0 is a decent proxy for "not started" or "empty"
        // The user request says "for future/current weeks where official projections are missing"
        // Let's calculate it always, and decide when to show it in render.
        const userProjected = calculateProjectedScore(userMatchup.starters, seasonMatchups, players);
        const opponentProjected = opponentMatchup ? calculateProjectedScore(opponentMatchup.starters, seasonMatchups, players) : 0;

        // Calculate remaining players
        const userRemaining = [];
        const opponentRemaining = [];

        if (players && Object.keys(gameStatuses).length > 0) {
            // User's remaining players
            const userStarters = userMatchup.starters || [];
            const userPlayersPoints = userMatchup.players_points || {};

            userStarters.forEach(playerId => {
                const playerPoints = userPlayersPoints[playerId] || 0;
                const player = players[playerId];

                if (player && playerPoints === 0) {
                    const playerTeam = player.team;
                    const teamStatus = gameStatuses[playerTeam];

                    if (teamStatus === 'scheduled') {
                        const playerName = `${player.first_name?.[0]}. ${player.last_name}`;
                        userRemaining.push(playerName);
                    }
                }
            });

            // Opponent's remaining players
            if (opponentMatchup) {
                const opponentStarters = opponentMatchup.starters || [];
                const opponentPlayersPoints = opponentMatchup.players_points || {};

                opponentStarters.forEach(playerId => {
                    const playerPoints = opponentPlayersPoints[playerId] || 0;
                    const player = players[playerId];

                    if (player && playerPoints === 0) {
                        const playerTeam = player.team;
                        const teamStatus = gameStatuses[playerTeam];

                        if (teamStatus === 'scheduled') {
                            const playerName = `${player.first_name?.[0]}. ${player.last_name}`;
                            opponentRemaining.push(playerName);
                        }
                    }
                });
            }
        }

        return {
            userScore,
            opponentScore,
            userProjected,
            opponentProjected,
            opponentName: displayTeamName(opponentUser),
            userRemaining,
            opponentRemaining
        };
    }, [week, users, rosters, matchups, selectedUserId, players, gameStatuses, seasonMatchups]);

    if (!matchupData) return null;

    // Helper to render score with tooltip if projected
    const ScoreDisplay = ({ score, projected, label }) => {
        // Show projected if score is 0. This is a simple heuristic.
        // A better one might be to check if all players have played, but 0 is safe for "future".
        const showProjected = score === 0 && projected > 0;

        return (
            <div className={label === 'VS' ? '' : 'text-right'}>
                <div className={`text-3xl font-bold ${showProjected ? 'text-blue-300' : (label === 'My Score' ? 'text-white' : 'text-slate-400')}`}>
                    {showProjected ? projected.toFixed(2) : score.toFixed(2)}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 justify-end">
                    {label}
                    {showProjected && (
                        <div className="group relative">
                            <Info className="w-3 h-3 text-blue-400 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 border border-slate-700 p-2 rounded shadow-lg text-[10px] text-slate-300 hidden group-hover:block z-50">
                                Note: Official player projections are not available via the public Sleeper API. This score is an estimate calculated by summing the historical averages of the currently active starting lineup.
                            </div>
                        </div>
                    )}
                </div>
                {showProjected && <div className="text-[10px] text-blue-400/70 font-medium mt-0.5">Proj (Avg)*</div>}
            </div>
        );
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Week {week} Matchup</h3>

            <div className="flex justify-between items-end mb-4">
                <div className="text-left">
                    <div className={`text-3xl font-bold ${matchupData.userScore === 0 && matchupData.userProjected > 0 ? 'text-blue-300' : 'text-white'}`}>
                        {matchupData.userScore === 0 && matchupData.userProjected > 0 ? matchupData.userProjected.toFixed(2) : matchupData.userScore.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        My Score
                        {matchupData.userScore === 0 && matchupData.userProjected > 0 && (
                            <div className="group relative">
                                <Info className="w-3 h-3 text-blue-400 cursor-help" />
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-700 p-2 rounded shadow-lg text-[10px] text-slate-300 hidden group-hover:block z-50">
                                    Note: Official player projections are not available via the public Sleeper API. This score is an estimate calculated by summing the historical averages of the currently active starting lineup.
                                </div>
                            </div>
                        )}
                    </div>
                    {matchupData.userScore === 0 && matchupData.userProjected > 0 && <div className="text-[10px] text-blue-400/70 font-medium mt-0.5">Proj (Avg)*</div>}
                </div>

                <div className="text-sm font-medium text-slate-500 mb-4">VS</div>

                <div className="text-right">
                    <div className={`text-3xl font-bold ${matchupData.opponentScore === 0 && matchupData.opponentProjected > 0 ? 'text-blue-300' : 'text-slate-400'}`}>
                        {matchupData.opponentScore === 0 && matchupData.opponentProjected > 0 ? matchupData.opponentProjected.toFixed(2) : matchupData.opponentScore.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 justify-end">
                        {matchupData.opponentName}
                        {matchupData.opponentScore === 0 && matchupData.opponentProjected > 0 && (
                            <div className="group relative">
                                <Info className="w-3 h-3 text-blue-400 cursor-help" />
                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 border border-slate-700 p-2 rounded shadow-lg text-[10px] text-slate-300 hidden group-hover:block z-50">
                                    Note: Official player projections are not available via the public Sleeper API. This score is an estimate calculated by summing the historical averages of the currently active starting lineup.
                                </div>
                            </div>
                        )}
                    </div>
                    {matchupData.opponentScore === 0 && matchupData.opponentProjected > 0 && <div className="text-[10px] text-blue-400/70 font-medium mt-0.5">Proj (Avg)*</div>}
                </div>
            </div>

            {/* Remaining Players */}
            {(matchupData.userRemaining.length > 0 || matchupData.opponentRemaining.length > 0) && (
                <div className="space-y-2 pt-4 border-t border-slate-700">
                    {matchupData.userRemaining.length > 0 && (
                        <div className="text-xs">
                            <span className="text-slate-400">Yet to Play ({matchupData.userRemaining.length}): </span>
                            <span className="text-blue-400">{matchupData.userRemaining.join(', ')}</span>
                        </div>
                    )}
                    {matchupData.opponentRemaining.length > 0 && (
                        <div className="text-xs">
                            <span className="text-slate-400">Opponent Remaining ({matchupData.opponentRemaining.length}): </span>
                            <span className="text-orange-400">{matchupData.opponentRemaining.join(', ')}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WidgetMatchupPreview;
