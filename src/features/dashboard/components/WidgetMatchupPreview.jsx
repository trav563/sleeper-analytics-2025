import { useMemo, useState, useEffect } from 'react';
import { displayTeamName } from '../../../utils/nflData';
import { getGameStatuses } from '../../../services/nflSchedule';

const WidgetMatchupPreview = ({ week, users, rosters, matchups, selectedUserId, players }) => {
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

        const userScore = userMatchup.points || 0;
        const opponentScore = opponentMatchup?.points || 0;

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
            opponentName: displayTeamName(opponentUser),
            userRemaining,
            opponentRemaining
        };
    }, [week, users, rosters, matchups, selectedUserId, players, gameStatuses]);

    if (!matchupData) return null;

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Week {week} Matchup</h3>

            <div className="flex justify-between items-end mb-4">
                <div>
                    <div className="text-3xl font-bold text-white">{matchupData.userScore.toFixed(2)}</div>
                    <div className="text-xs text-slate-400 mt-1">My Score</div>
                </div>
                <div className="text-sm font-medium text-slate-500 mb-4">VS</div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-slate-400">{matchupData.opponentScore.toFixed(2)}</div>
                    <div className="text-xs text-slate-400 mt-1">{matchupData.opponentName}</div>
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
