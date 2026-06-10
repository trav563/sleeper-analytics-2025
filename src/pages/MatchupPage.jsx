import { useEffect, useMemo, useState } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import MatchupDetail from '../features/league/components/MatchupDetail';
import { fetchLeagueMatchups } from '../utils/sleeper';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';
import ErrorState from '../components/ui/ErrorState';

const MatchupPage = () => {
    const { leagueId, week: weekParam } = useParams();
    const navigate = useNavigate();
    const ctx = useOutletContext();
    const { league, rosters, users, players, state, matchups: currentWeekMatchups, user, currentWeek } = ctx || {};
    const currentNFLWeek = currentWeek || state?.display_week || state?.week || 1;
    const week = weekParam ? Number(weekParam) : currentNFLWeek;
    const handleWeekChange = (nextWeek) => {
        const w = Number(nextWeek);
        if (!w || w === week) return;
        navigate(`/league/${leagueId}/matchup/${w}`);
    };

    const [viewMatchups, setViewMatchups] = useState(week === currentNFLWeek ? currentWeekMatchups : []);
    const [loading, setLoading] = useState(week !== currentNFLWeek);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    /* Selected roster for the focused matchup. Defaults to the logged-in
       user's roster; falls back to the first roster if the user isn't in
       this league. The picker UI inside MatchupDetail can change it. */
    const defaultRosterId = useMemo(() => {
        if (!rosters?.length) return null;
        const mine = rosters.find((r) => r.owner_id === user?.user_id);
        return (mine || rosters[0]).roster_id;
    }, [rosters, user?.user_id]);
    const [selectedRosterId, setSelectedRosterId] = useState(defaultRosterId);

    // Reset selection when the user/league changes.
    useEffect(() => { setSelectedRosterId(defaultRosterId); }, [defaultRosterId]);

    useEffect(() => {
        if (!league?.league_id) return;
        if (week === currentNFLWeek && currentWeekMatchups?.length > 0) {
            setViewMatchups(currentWeekMatchups);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchLeagueMatchups(league.league_id, week)
            .then((data) => {
                if (!cancelled) {
                    setViewMatchups(data || []);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Failed to load matchup', err);
                    setError(`Couldn't load week ${week} matchups.`);
                    setLoading(false);
                }
            });
        return () => { cancelled = true; };
    }, [week, league?.league_id, currentNFLWeek, currentWeekMatchups, reloadKey]);

    const { seasonMatchups } = useSeasonMatchups(league?.league_id, currentNFLWeek);

    if (loading) {
        return (
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute p-12 text-center">
                Loading matchup…
            </div>
        );
    }

    if (error) {
        return (
            <ErrorState
                className="py-12"
                message={error}
                onRetry={() => setReloadKey((k) => k + 1)}
            />
        );
    }

    const isHistoricalSeason = league?.season && state?.season &&
        Number(league.season) < Number(state.season);

    return (
        <MatchupDetail
            league={league}
            rosters={rosters}
            users={users}
            players={players}
            week={week}
            currentNFLWeek={currentNFLWeek}
            isHistoricalSeason={isHistoricalSeason}
            onWeekChange={handleWeekChange}
            viewMatchups={viewMatchups}
            seasonMatchups={seasonMatchups}
            selectedRosterId={selectedRosterId}
            onSelectRoster={setSelectedRosterId}
        />
    );
};

export default MatchupPage;
