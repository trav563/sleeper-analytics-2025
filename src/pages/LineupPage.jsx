import { useParams } from 'react-router-dom';
import LineupChecker from '../features/league/components/LineupChecker';

const LineupPage = () => {
    const { leagueId } = useParams();
    return <LineupChecker leagueId={leagueId} />;
};

export default LineupPage;
