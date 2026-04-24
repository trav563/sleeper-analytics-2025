import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, BarChart2, HelpCircle } from 'lucide-react';
import { usePlayoffOdds } from '../hooks/usePlayoffOdds';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { fetchLeagueRosters } from '../../../utils/sleeper';

const StatCard = ({ label, value, sub, icon: Icon, iconTone = 'text-signal', valueTone = 'text-text', tooltip }) => (
    <div className="relative group bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-line/60 flex items-center justify-between">
            <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute">{label}</h3>
            <Icon className={`w-4 h-4 ${iconTone}`} aria-hidden="true" />
        </div>
        <div className="px-4 py-4 text-center">
            <div className={`font-display tnum text-3xl font-bold ${valueTone}`}>{value}</div>
            {sub && (
                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1 flex items-center justify-center gap-1">
                    {sub}
                    {tooltip && <HelpCircle className="w-3 h-3" aria-hidden="true" />}
                </div>
            )}
        </div>
        {tooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-bg-1 text-xs text-left text-text rounded-md shadow-pop opacity-0 group-hover:opacity-100 transition-opacity w-64 pointer-events-none z-20 border border-line">
                {tooltip}
            </div>
        )}
    </div>
);

const WidgetQuickStats = ({ rosters, selectedUserId, league, currentWeek, seasonMatchups, state }) => {
    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', league?.league_id],
        queryFn: () => fetchMarketValues(
            league?.roster_positions?.includes('SUPER_FLEX'),
            rosters?.length || 12,
            0.5
        ),
        staleTime: 60 * 60 * 1000,
        enabled: !!league,
    });

    const [prevSeasonRosters, setPrevSeasonRosters] = useState(null);
    useEffect(() => {
        if (!league?.previous_league_id) return;
        let cancelled = false;
        fetchLeagueRosters(league.previous_league_id)
            .then(data => { if (!cancelled && data) setPrevSeasonRosters(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [league?.previous_league_id]);

    const seasonType = state?.season_type || 'regular';
    const { odds, loading: oddsLoading, isProjection } = usePlayoffOdds(league, rosters, currentWeek, marketValues, seasonType, prevSeasonRosters);

    const stats = useMemo(() => {
        if (!selectedUserId || !Array.isArray(rosters)) return null;

        const roster = rosters.find(r => r.owner_id === selectedUserId);
        if (!roster) return null;

        const sortedRosters = [...rosters].sort((a, b) => {
            if (a.settings.wins !== b.settings.wins) return b.settings.wins - a.settings.wins;
            return (b.settings.fpts + (b.settings.fpts_decimal || 0) / 100) - (a.settings.fpts + (a.settings.fpts_decimal || 0) / 100);
        });

        const rank = sortedRosters.findIndex(r => r.roster_id === roster.roster_id) + 1;

        let streak = '—';
        let streakType = null;
        if (seasonMatchups && Object.keys(seasonMatchups).length > 0) {
            let streakCount = 0;
            const weeks = Object.keys(seasonMatchups).map(Number).sort((a, b) => b - a);
            for (const week of weeks) {
                const weekData = seasonMatchups[week];
                if (!weekData) continue;
                const userMatch = weekData.find(m => m.roster_id === roster.roster_id);
                if (!userMatch || userMatch.matchup_id == null) continue;
                const opponent = weekData.find(m => m.matchup_id === userMatch.matchup_id && m.roster_id !== roster.roster_id);
                if (!opponent) continue;
                if ((userMatch.points || 0) === 0 && (opponent.points || 0) === 0) continue;
                const won = (userMatch.points || 0) > (opponent.points || 0);
                const result = won ? 'W' : 'L';
                if (streakType === null) {
                    streakType = result;
                    streakCount = 1;
                } else if (result === streakType) {
                    streakCount++;
                } else {
                    break;
                }
            }
            if (streakCount > 0) streak = `${streakCount}${streakType}`;
        }

        let playoffOddsDisplay = '…';
        let playoffStatus = '';

        if (odds && odds[roster.roster_id]) {
            const data = odds[roster.roster_id];
            playoffOddsDisplay = `${data.percent}%`;
            if (data.status === 'Clinched') playoffStatus = 'Clinched';
            if (data.status === 'Eliminated') playoffStatus = 'Eliminated';
        }

        return {
            rank,
            wins: roster.settings.wins,
            losses: roster.settings.losses,
            ties: roster.settings.ties,
            playoffOddsDisplay,
            playoffStatus,
            streak,
            streakType,
        };
    }, [selectedUserId, rosters, odds, seasonMatchups]);

    if (!stats) return null;

    const rankTone = stats.rank === 1 ? 'text-signal' : stats.rank <= 3 ? 'text-text' : 'text-text-dim';
    const playoffTone =
        stats.playoffStatus === 'Clinched' ? 'text-good'
        : stats.playoffStatus === 'Eliminated' ? 'text-bad'
        : 'text-text';
    const streakTone = stats.streakType === 'W' ? 'text-good' : stats.streakType === 'L' ? 'text-bad' : 'text-text-dim';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
                label="Current Rank"
                value={`#${stats.rank}`}
                sub={`${stats.wins}-${stats.losses}${stats.ties > 0 ? `-${stats.ties}` : ''}`}
                icon={Trophy}
                iconTone="text-signal"
                valueTone={rankTone}
            />
            <StatCard
                label="Playoff Odds"
                value={oddsLoading ? '…' : stats.playoffOddsDisplay}
                sub={isProjection ? 'Preseason Projection' : 'Monte Carlo Sim'}
                icon={BarChart2}
                iconTone={stats.playoffStatus === 'Clinched' ? 'text-good' : stats.playoffStatus === 'Eliminated' ? 'text-bad' : 'text-signal'}
                valueTone={playoffTone}
                tooltip={isProjection
                    ? 'Simulates 10,000 seasons using previous season performance and current roster dynasty values. Updates as you make trades, pickups, and draft picks.'
                    : "Simulates the remaining schedule 10,000 times based on each team's Average Points Per Game."}
            />
            <StatCard
                label="Streak"
                value={stats.streak}
                sub="Current Streak"
                icon={TrendingUp}
                iconTone={streakTone}
                valueTone={streakTone}
            />
        </div>
    );
};

export default WidgetQuickStats;
