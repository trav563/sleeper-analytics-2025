import { useOutletContext } from 'react-router-dom';
import StandingsPower from '../features/analytics/components/StandingsPower';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';

const StandingsPage = () => {
    const ctx = useOutletContext();
    const { league, rosters, users, state, user } = ctx || {};
    const week = state?.display_week || state?.week || 1;
    const { seasonMatchups } = useSeasonMatchups(league?.league_id, week);

    return (
        <StandingsPower
            league={league}
            rosters={rosters}
            users={users}
            seasonMatchups={seasonMatchups}
            currentUserId={user?.user_id}
            week={week}
        />
    );
};

export default StandingsPage;
