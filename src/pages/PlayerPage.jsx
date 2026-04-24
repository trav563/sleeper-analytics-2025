import { useParams, useOutletContext } from 'react-router-dom';
import PlayerDetail from '../features/dashboard/components/PlayerDetail';

const PlayerPage = () => {
    const { playerId } = useParams();
    const { players, rosters, users, league, state, currentWeek } = useOutletContext();
    const player = players?.[playerId] ? { ...players[playerId], player_id: playerId } : null;

    return (
        <PlayerDetail
            player={player}
            league={league}
            rosters={rosters}
            users={users}
            state={state}
            currentWeek={currentWeek}
        />
    );
};

export default PlayerPage;
