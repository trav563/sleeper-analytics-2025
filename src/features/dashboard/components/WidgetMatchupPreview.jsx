import { useMemo } from 'react';
import { displayTeamName } from '../../../utils/nflData';

const WidgetMatchupPreview = ({ week, users, rosters, matchups, selectedUserId }) => {
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
        const totalScore = userScore + opponentScore;

        // Check if matchup is complete by looking at players_points
        // If players_points exists and has scores, we can check completion
        // For now, use a simpler heuristic: if points > 0 and it's a significant difference
        // we assume the week might be complete. Better: check if there are projected points remaining

        // Calculate win probability
        let winProb;
        const diff = userScore - opponentScore;

        // Check if matchup appears complete (heuristic: if both teams have > 50 points, likely week 12+)
        // A more accurate check would be to see if starters_points adds up to points (meaning all played)
        const userPlayersPoints = userMatchup.players_points || {};
        const userStartersPoints = (userMatchup.starters || [])
            .reduce((sum, pid) => sum + (userPlayersPoints[pid] || 0), 0);
        const userHasAllScored = Math.abs(userStartersPoints - userScore) < 0.1; // Within 0.1 due to rounding

        const opponentPlayersPoints = opponentMatchup?.players_points || {};
        const opponentStartersPoints = (opponentMatchup?.starters || [])
            .reduce((sum, pid) => sum + (opponentPlayersPoints[pid] || 0), 0);
        const opponentHasAllScored = Math.abs(opponentStartersPoints - opponentScore) < 0.1;

        const matchupComplete = userHasAllScored && opponentHasAllScored && userScore > 0;

        if (matchupComplete) {
            // If matchup is complete, set to 99% for winner, 1% for loser (accounting for stat corrections)
            winProb = diff > 0 ? 99 : (diff < 0 ? 1 : 50);
        } else {
            // Use logistic function for ongoing matchups
            // Sigmoid: 1 / (1 + e^-x)
            // We want a 25 pt lead to be ~90% win prob
            // Using base 10 for easier mental math: 1 / (1 + 10^(-diff/30))
            winProb = (1 / (1 + Math.pow(10, -diff / 30))) * 100;
        }

        return {
            userScore,
            opponentScore,
            winProb,
            opponentName: displayTeamName(opponentUser)
        };
    }, [week, users, rosters, matchups, selectedUserId]);

    if (!matchupData) return null;

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Week {week} Matchup</h3>

            <div className="flex justify-between items-end mb-2">
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

            <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Win Probability</span>
                    <span className="text-white">{matchupData.winProb.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${matchupData.winProb}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default WidgetMatchupPreview;
