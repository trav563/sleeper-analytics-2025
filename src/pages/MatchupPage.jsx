import { useParams, useOutletContext } from 'react-router-dom';

const MatchupPage = () => {
    const { week: weekParam } = useParams();
    const ctx = useOutletContext();
    const week = weekParam ? Number(weekParam) : (ctx?.state?.display_week || 1);

    return (
        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute p-12 text-center">
            Matchup page coming · Week <span className="tnum">{week}</span>
        </div>
    );
};

export default MatchupPage;
