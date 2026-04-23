import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import MatchupDetail from '../features/league/components/MatchupDetail';
import { fetchLeagueMatchups } from '../utils/sleeper';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';

const MatchupPage = () => {
    const { week: weekParam } = useParams();
    const ctx = useOutletContext();
    const { league, rosters, users, players, state, matchups: currentWeekMatchups, user } = ctx || {};
    const currentNFLWeek = state?.display_week || state?.week || 1;
    const week = weekParam ? Number(weekParam) : currentNFLWeek;

    const [viewMatchups, setViewMatchups] = useState(week === currentNFLWeek ? currentWeekMatchups : []);
    const [loading, setLoading] = useState(week !== currentNFLWeek);

    useEffect(() => {
        if (!league?.league_id) return;
        if (week === currentNFLWeek && currentWeekMatchups?.length > 0) {
            setViewMatchups(currentWeekMatchups);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchLeagueMatchups(league.league_id, week)
            .then((data) => {
                if (!cancelled) {
                    setViewMatchups(data || []);
                    setLoading(false);
                }
            })
            .catch(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [week, league?.league_id, currentNFLWeek, currentWeekMatchups]);

    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentNFLWeek);

    if (loading) {
        return (
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute p-12 text-center">
                Loading matchup…
            </div>
        );
    }

    return (
        <MatchupDetail
            league={league}
            rosters={rosters}
            users={users}
            players={players}
            week={week}
            viewMatchups={viewMatchups}
            seasonMatchups={seasonMatchups}
            currentUserId={user?.user_id}
        />
    );
};

export default MatchupPage;
