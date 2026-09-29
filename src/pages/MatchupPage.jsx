import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLeagueView, validWeek } from '../hooks/useLeagueView';
import { useParams, useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    const { roster, week: savedWeek, selectRoster, selectWeek } = useLeagueView(leagueId, rosters, user, currentNFLWeek);
    const week = validWeek(weekParam) ? Number(weekParam) : savedWeek;
    const requestedRoster = Number(searchParams.get('roster'));
    const selectedRosterId = rosters?.some(r => r.roster_id === requestedRoster) ? requestedRoster : roster?.roster_id;
    useEffect(() => { selectWeek(week); }, [week, selectWeek]);
    useEffect(() => { if (selectedRosterId) selectRoster(selectedRosterId); }, [selectedRosterId, selectRoster]);
    const handleWeekChange = next => {
        if (validWeek(next)) navigate(`/league/${leagueId}/matchup/${Number(next)}?roster=${selectedRosterId}`);
    };
    const handleRosterChange = id => {
        selectRoster(id);
        navigate(`/league/${leagueId}/matchup/${week}?roster=${id}`);
    };
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['leagueMatchups', leagueId, week],
        queryFn: () => fetchLeagueMatchups(leagueId, week),
        enabled: !!leagueId && week !== currentNFLWeek,
        staleTime: 60000,
    });
    const viewMatchups = week === currentNFLWeek ? currentWeekMatchups || [] : data || [];
    const loading = week !== currentNFLWeek && isLoading;

    const { seasonMatchups, completedWeek, loading: recordsLoading, error: recordsError } = useSeasonMatchups(league?.league_id, week);

    if (loading) {
        return (
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute p-12 text-center">
                Loading matchup…
            </div>
        );
    }

    if (error && week !== currentNFLWeek && !data) {
        return (
            <ErrorState
                className="py-12"
                message={`Could not load Week ${week}. Check your connection and try again.`}
                onRetry={refetch}
            />
        );
    }

    const isHistoricalSeason = league?.season && state?.season &&
        Number(league.season) < Number(state.season);

    return (
        <>
        {error && week !== currentNFLWeek && <p role="status" className="text-sm text-warn mb-4">This week could not refresh. Showing the last available scores. <button type="button" onClick={() => refetch()} className="min-h-11 underline">Try again</button></p>}
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
            completedWeek={completedWeek}
            recordsLoading={recordsLoading}
            recordsError={recordsError}
            ownTeam={!!user?.user_id && rosters?.some(r => r.roster_id === selectedRosterId && (r.owner_id === user.user_id || r.co_owners?.includes(user.user_id)))}
            selectedRosterId={selectedRosterId}
            onSelectRoster={handleRosterChange}
        />
        </>
    );
};

export default MatchupPage;
