import { useEffect } from 'react';
import { useWeekProjections } from './useWeekProjections';
import { recordLeagueProbabilitySnapshots } from '../../../lib/winProbabilityHistory';

export function useRecordWinProbabilityHistory({ league, week, matchups, players, games, scoresUpdatedAt, gamesUpdatedAt, enabled }) {
    const { projections } = useWeekProjections(league?.season, week, league?.scoring_settings, enabled);
    useEffect(() => {
        recordLeagueProbabilitySnapshots({ league, week, matchups, players, games, projections, scoresUpdatedAt, gamesUpdatedAt,
            enabled: enabled && document.visibilityState === 'visible' });
    }, [league, week, matchups, players, games, projections, scoresUpdatedAt, gamesUpdatedAt, enabled]);
}
