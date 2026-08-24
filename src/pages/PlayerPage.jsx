import { useParams, useOutletContext } from 'react-router-dom';
import PlayerDetail from '../features/dashboard/components/PlayerDetail';

const PlayerPage = () => {
    const { playerId } = useParams();
    const { players, rosters, users, league, state, currentWeek } = useOutletContext();
    const player = players?.[playerId] ? { ...players[playerId], player_id: playerId } : null;
    const isHistoricalSeason = league?.season && state?.season &&
        Number(league.season) < Number(state.season);

    return (
        <PlayerDetail
            player={player}
            players={players}
            league={league}
            rosters={rosters}
            users={users}
            state={state}
            currentWeek={currentWeek}
            isHistoricalSeason={isHistoricalSeason}
        />
    );
};

export default PlayerPage;
