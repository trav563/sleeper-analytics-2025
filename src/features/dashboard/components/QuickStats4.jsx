import { useMarketValues } from '../../tools/hooks/useMarketValues';
import { useMemo, useState, useEffect } from 'react';


import { fetchLeagueRosters } from '../../../utils/sleeper';
import { usePlayoffOdds } from '../hooks/usePlayoffOdds';
import { usePowerRankings } from '../../analytics/hooks/usePowerRankings';

/* Compute current win/loss streak for the user from seasonMatchups. */
const computeStreak = (rosterId, seasonMatchups) => {
    if (!seasonMatchups || !rosterId) return null;
    const weeks = Object.keys(seasonMatchups).map(Number).sort((a, b) => b - a);
    let count = 0;
    let kind = null;
    for (const w of weeks) {
        const data = seasonMatchups[w];
        if (!Array.isArray(data)) continue;
        const me = data.find((m) => m.roster_id === rosterId);
        if (!me || me.matchup_id == null) continue;
        const opp = data.find((m) => m.matchup_id === me.matchup_id && m.roster_id !== rosterId);
        if (!opp) continue;
        if (me.points === opp.points) break;
        const won = (me.points || 0) > (opp.points || 0);
        const result = won ? 'W' : 'L';
        if (kind === null) { kind = result; count = 1; }
        else if (result === kind) count += 1;
        else break;
    }
    return count > 0 ? { kind, count } : null;
};

/**
 * Right-rail 2x2 grid of league-context stats. Mirrors design's dir-a.jsx
 * QuickStats block (RANK / PLAYOFF / STREAK / PF-PA).
 */
const QuickStats4 = ({ rosters, users, selectedUserId, league, currentWeek, seasonMatchups, state }) => {
    const myRoster = useMemo(
        () => rosters?.find((r) => r.owner_id === selectedUserId) || null,
        [rosters, selectedUserId]
    );

    /* Market values + previous-season rosters needed for usePlayoffOdds. */
    const { data: marketValues } = useMarketValues(league, rosters?.length);
    const [prevSeasonRosters, setPrevSeasonRosters] = useState(null);
    useEffect(() => {
        if (!league?.previous_league_id) return;
        let cancelled = false;
        fetchLeagueRosters(league.previous_league_id)
            .then((data) => { if (!cancelled && data) setPrevSeasonRosters(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [league?.previous_league_id]);

    const seasonType = state?.season_type || 'regular';
    const { odds, loading: oddsLoading, isProjection } = usePlayoffOdds(
        league, rosters, currentWeek, marketValues, seasonType, prevSeasonRosters
    );
    const { rankings, ranked } = usePowerRankings(seasonMatchups, rosters, users);

    /* Pick the four cells. */
    const cells = useMemo(() => {
        if (!myRoster) return [];
        const myRanking = rankings.find((r) => r.rosterId === myRoster.roster_id);
        // Before any games every composite ties, so the "rank" would just be
        // roster order. Show nothing rather than a meaningless number.
        const rank = ranked ? (myRanking?.currentRank ?? null) : null;
        const rankChange = myRanking?.rankChange ?? 0;
        const myOdds = odds?.[myRoster.roster_id];
        const oddsPct = myOdds ? `${myOdds.percent}%` : (oddsLoading ? '…' : '—');
        const oddsStatus = myOdds?.status;
        const streak = computeStreak(myRoster.roster_id, seasonMatchups);

        const margin = (myRanking?.pf || 0) - (myRanking?.pa || 0);
        const sortedByPf = [...rankings].sort((a, b) => b.pf - a.pf);
        const pfRank = ranked ? sortedByPf.findIndex(r => r.rosterId === myRoster.roster_id) + 1 : 0;
        const pfSub = pfRank === 1 ? 'league high' : pfRank > 0 ? `#${pfRank} PF` : 'no completed weeks';

        return [
            {
                label: 'Rank',
                value: rank != null ? `#${rank}` : '—',
                sub: !ranked ? 'not ranked yet' : rankChange > 0 ? `▲ ${rankChange} wk` : rankChange < 0 ? `▼ ${Math.abs(rankChange)} wk` : 'no change',
                subTone: rankChange > 0 ? 'good' : rankChange < 0 ? 'bad' : 'mute',
                valueTone: rank === 1 ? 'signal' : 'text',
            },
            {
                label: 'Playoff',
                value: oddsPct,
                sub: isProjection ? 'projection' : oddsStatus === 'Clinched' ? 'clinched' : oddsStatus === 'Eliminated' ? 'eliminated' : 'monte carlo',
                subTone: oddsStatus === 'Clinched' ? 'good' : oddsStatus === 'Eliminated' ? 'bad' : 'mute',
                valueTone: oddsStatus === 'Clinched' ? 'good' : oddsStatus === 'Eliminated' ? 'bad' : 'text',
            },
            {
                label: 'Streak',
                value: streak ? `${streak.kind}${streak.count}` : '—',
                sub: streak ? `${streak.count} game${streak.count !== 1 ? 's' : ''}` : '—',
                subTone: streak?.kind === 'W' ? 'good' : streak?.kind === 'L' ? 'bad' : 'mute',
                valueTone: streak?.kind === 'W' ? 'good' : streak?.kind === 'L' ? 'bad' : 'text',
            },
            {
                label: 'PF / PA',
                value: (margin >= 0 ? '+' : '') + margin.toFixed(0),
                sub: pfSub,
                subTone: margin > 0 ? 'good' : margin < 0 ? 'bad' : 'mute',
                valueTone: 'text',
            },
        ];
    }, [myRoster, rankings, ranked, odds, oddsLoading, isProjection, seasonMatchups]);

    if (cells.length === 0) return null;

    return (
        <div className="grid grid-cols-2 gap-3">
            {cells.map((s) => (
                <div key={s.label} className="rounded-xl bg-bg-1 border border-line p-3 shadow-card">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">
                        {s.label}
                    </div>
                    <div
                        className={`tnum font-display text-2xl md:text-[26px] font-extrabold tracking-tight mt-1 leading-none ${
                            s.valueTone === 'signal' ? 'text-signal'
                            : s.valueTone === 'good' ? 'text-good'
                            : s.valueTone === 'bad' ? 'text-bad'
                            : 'text-text'
                        }`}
                    >
                        {s.value}
                    </div>
                    <div
                        className={`font-mono text-2xs mt-1 tnum ${
                            s.subTone === 'good' ? 'text-good'
                            : s.subTone === 'bad' ? 'text-bad'
                            : 'text-text-mute'
                        }`}
                    >
                        {s.sub}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default QuickStats4;
