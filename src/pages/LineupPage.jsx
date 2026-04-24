import { useParams } from 'react-router-dom';
import LineupChecker from '../features/league/components/LineupChecker';
import HistoricalBanner from '../components/layout/HistoricalBanner';

const LineupPage = () => {
    const { leagueId } = useParams();
    return (
        <>
            <HistoricalBanner message="Lineup decisions are locked for past seasons." />
            <LineupChecker leagueId={leagueId} />
        </>
    );
};

export default LineupPage;
