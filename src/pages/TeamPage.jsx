import { useParams, useOutletContext } from 'react-router-dom';
import RosterDetail from '../features/league/components/RosterDetail';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';

const TeamPage = () => {
    const { rosterId } = useParams();
    const ctx = useOutletContext();
    const { league, rosters, users, players, state, matchups: currentWeekMatchups } = ctx || {};
    const numericId = Number(rosterId);
    const roster = rosters?.find((r) => r.roster_id === numericId) || null;
    const { seasonMatchups } = useSeasonMatchups(league?.league_id, state?.display_week || state?.week);

    return (
        <RosterDetail
            league={league}
            rosters={rosters}
            users={users}
            players={players}
            state={state}
            roster={roster}
            currentWeekMatchups={currentWeekMatchups}
            seasonMatchups={seasonMatchups}
        />
    );
};

export default TeamPage;
