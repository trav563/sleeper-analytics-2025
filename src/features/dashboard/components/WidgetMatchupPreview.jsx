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

        return {
            userScore,
            opponentScore,
            opponentName: displayTeamName(opponentUser)
        };
    }, [week, users, rosters, matchups, selectedUserId]);

    if (!matchupData) return null;

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Week {week} Matchup</h3>

            <div className="flex justify-between items-end">
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
        </div>
    );
};

export default WidgetMatchupPreview;
