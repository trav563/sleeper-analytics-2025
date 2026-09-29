import { leagueRecords } from '../../../utils/leagueRecords';
import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { WinProbabilityBadge } from '../../../components/ui/WinProbabilityBadge';
import { Pip } from '../../../components/ui/Pip';
import { LiveDot } from '../../../components/ui/LiveDot';
import { computeWinProbability } from '../../../lib/winProbability';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';
import { projectMatchup, formatProjection, estimateUnavailableMessage } from '../../../lib/liveProjection';
import { useWeekProjections } from '../../league/hooks/useWeekProjections';

import { matchupStatus, remainingStarters } from '../../../lib/matchupStatus';

const ROSTER_HUE = (rosterId) => (Number(rosterId || 0) * 47) % 360;

/**
 * Hero matchup card for the dashboard. Mirrors the design's
 * dir-a.jsx MyMatchupHero composition (large pip, full team name,
 * 72px score with glow, live estimated final score, win-prob bar at bottom).
 */
    const TeamSide = ({ league, navigate, user, roster, score, projFinal, isFinal, record, isWinning, ownTeam = false, recordsLoading, recordsError, mirror = false }) => {
        const identity = mirror ? 'Opponent' : ownTeam ? 'You' : 'Viewing';
        const recordLabel = recordsLoading ? `${identity} · record loading…` : recordsError ? `${identity} · record unavailable`
            : record?.complete ? `${record.record} · ${identity}` : `${identity} · no completed record`;
        const goTeam = (e) => {
            e.stopPropagation();
            if (league?.league_id && roster?.roster_id) {
                navigate(`/league/${league.league_id}/team/${roster.roster_id}`);
            }
        };
        return (
            <div className={`flex flex-col items-center text-center gap-2 md:gap-5 min-w-0 md:flex-row md:items-center ${mirror ? 'md:flex-row-reverse md:text-right' : 'md:text-left'}`}>
                <button
                    type="button"
                    onClick={goTeam}
                    className="shrink-0 rounded-full transition-all hover:ring-2 hover:ring-signal/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                    aria-label={`View ${displayTeamName(user)}`}
                >
                    {user?.avatar ? (
                        <img
                            src={avatarUrl(user.avatar)}
                            alt=""
                            className="w-12 h-12 md:w-[72px] md:h-[72px] rounded-full ring-1 ring-line"
                        />
                    ) : (
                        <Pip seed={roster?.roster_id} name={displayTeamName(user)} size={48} />
                    )}
                </button>
                <div className="min-w-0 w-full md:w-auto">
                    <div className="font-mono text-xs uppercase tracking-wider text-text-dim font-bold">
                        {recordLabel}
                    </div>
                    <button
                        type="button"
                        onClick={goTeam}
                        className={`block font-display text-sm md:text-xl font-bold tracking-snug text-text truncate w-full max-w-full md:max-w-[280px] mx-auto hover:text-signal transition-colors duration-fast ${mirror ? 'md:ml-auto md:mx-0 md:text-right' : 'md:mx-0 md:text-left'}`}
                    >
                        {displayTeamName(user)}
                    </button>
                    <div
                        className={`tnum font-display text-4xl md:text-[72px] font-extrabold tracking-tight leading-none mt-1 ${isWinning ? 'text-signal' : 'text-text'}`}
                        style={isWinning ? { textShadow: '0 0 28px rgba(245,179,1,0.33)' } : undefined}
                    >
                        {score.toFixed(1)}
                    </div>
                    <div className="font-mono text-xs text-text-dim mt-1">
                        {isFinal ? 'Final' : 'Est. final'} <span className="tnum text-text-dim">{formatProjection(projFinal)}</span>
                    </div>
                </div>
            </div>
        );
    };


const MyMatchupHero = ({ league, week, viewMatchups, rosters, users, players, selectedUserId, selectedRosterId, seasonMatchups, ownTeam = false, completedWeek = 0, recordsLoading = false, recordsError = null }) => {
    const records = leagueRecords(rosters, seasonMatchups, league);
    /* Real weekly projections scored with this league's settings. */
    const { projections, error: projectionError, loading: projectionsLoading } = useWeekProjections(league?.season, week, league?.scoring_settings);
    const navigate = useNavigate();
    const { details: liveDetails, error: gameError } = useGameLiveDetails(week, league?.season);

    const { myRoster, myMatchup, oppRoster, oppMatchup, myUser, oppUser } = useMemo(() => {
        if (!Array.isArray(viewMatchups) || !rosters) return {};
        const me = rosters.find(r => r.roster_id === selectedRosterId) || rosters.find((r) => r.owner_id === selectedUserId) || rosters[0];
        if (!me) return {};
        const myMatchup = viewMatchups.find((m) => m.roster_id === me.roster_id);
        if (!myMatchup) return { myRoster: me };
        const oppMatchup = viewMatchups.find(
            (m) => m.matchup_id === myMatchup.matchup_id && m.roster_id !== me.roster_id
        );
        const opp = oppMatchup ? rosters.find((r) => r.roster_id === oppMatchup.roster_id) : null;
        return {
            myRoster: me,
            myMatchup,
            oppRoster: opp,
            oppMatchup,
            myUser: users?.find((u) => u.user_id === me.owner_id),
            oppUser: opp ? users?.find((u) => u.user_id === opp.owner_id) : null,
        };
    }, [viewMatchups, rosters, users, selectedUserId, selectedRosterId]);

    const myHue = ROSTER_HUE(myRoster?.roster_id);
    const oppHue = ROSTER_HUE(oppRoster?.roster_id) || 180;

    if (!myMatchup) {
        return (
            <section
                className="rounded-xl border border-line p-5 shadow-card"
                style={{ background: `radial-gradient(circle at 0% 0%, oklch(62% 0.18 ${myHue} / 0.18), transparent 55%), var(--bg-1)` }}
            >
                <div className="font-mono text-xs uppercase tracking-wider text-text-mute">
                    No matchup data for week <span className="tnum">{week}</span>
                </div>
            </section>
        );
    }

    /* Score bookkeeping. */
    const myScore = myMatchup.points || 0;
    const oppScore = oppMatchup?.points || 0;
    const winning = myScore > oppScore;

    const myProj = projectMatchup({ matchup: myMatchup, players, projections, games: liveDetails, isWeekFinal: week > 0 && week <= completedWeek });
    const oppProj = projectMatchup({ matchup: oppMatchup, players, projections, games: liveDetails, isWeekFinal: week > 0 && week <= completedWeek });
    const myProjFinal = myProj.final;
    const oppProjFinal = oppProj.final;
    const projectionsAvailable = myProj.available && oppProj.available;
    const winProb = projectionsAvailable ? computeWinProbability({
        myCurrent: myScore,
        oppCurrent: oppScore,
        myProjRemaining: myProj.remaining,
        oppProjRemaining: oppProj.remaining,
    }) : null;

    const status = matchupStatus({ matchups: oppMatchup ? [myMatchup, oppMatchup] : [myMatchup], players, games: liveDetails, week, completedWeek });
    const outcome = status === 'Final' && oppMatchup
        ? myScore > oppScore ? 'Win' : myScore < oppScore ? 'Loss' : 'Tie'
        : null;
    const anyLive = status === 'Live';
    const remainingMine = remainingStarters(myMatchup, players, liveDetails, status === 'Final');
    /* Pull the most-active starter's clock for the eyebrow Q+time (best heuristic). */
    const liveTime = (myMatchup.starters || []).reduce((acc, pid) => {
        if (acc) return acc;
        const team = players?.[pid]?.team;
        const d = team ? liveDetails?.[team] : null;
        if (d && (d.statusName === 'STATUS_IN_PROGRESS' || d.statusName === 'STATUS_HALFTIME') && d.displayClock) {
            return `Q${d.period} ${d.displayClock}`;
        }
        return acc;
    }, '');

    return (
        <section
            className="w-full text-left rounded-xl border border-line p-5 md:p-6 shadow-card relative overflow-hidden transition-colors duration-fast hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
            style={{
                background: `
                    radial-gradient(circle at 10% 0%, oklch(62% 0.18 ${myHue} / 0.32), transparent 55%),
                    radial-gradient(circle at 90% 100%, oklch(62% 0.18 ${oppHue} / 0.25), transparent 55%),
                    var(--bg-1)
                `,
            }}
        >
            {/* Eyebrow */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-5">
                <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                    {anyLive ? (
                        <>
                            <LiveDot />
                            <span className="font-mono text-xs uppercase tracking-wider font-bold text-signal-2">
                                Live · Week <span className="tnum">{week}</span> Matchup
                            </span>
                        </>
                    ) : (
                        <span className="font-mono text-xs uppercase tracking-wider font-bold text-text-mute">
                            {status === 'Unavailable' ? 'Status unavailable' : status} · Week <span className="tnum">{week}</span>
                        </span>
                    )}
                </div>
                <div className="font-mono text-xs uppercase tracking-wider text-text-dim">
                    {anyLive && liveTime && <><span className="text-text-dim tnum">{liveTime}</span> · </>}
                    {remainingMine == null ? 'Players remaining unavailable' : <><span className="tnum">{remainingMine}</span> players left</>}
                </div>
                </div>
                <WinProbabilityBadge probability={winProb} outcome={outcome} />
            </div>

            <Link to={`/league/${league?.league_id}/matchup/${week}?roster=${myRoster?.roster_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-signal mb-2">View Week {week} matchup</Link>
            {/* Teams + center pod */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 md:gap-6 items-center">
                <TeamSide ownTeam={ownTeam} recordsLoading={recordsLoading} recordsError={recordsError} record={records.find(r => r.rosterId === myRoster?.roster_id)} league={league} navigate={navigate}
                    user={myUser}
                    roster={myRoster}
                    score={myScore}
                    projFinal={myProjFinal} isFinal={myProj.isFinal}
                    isWinning={winning && myScore > 0}
                />

                <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="font-mono text-xs uppercase tracking-wider text-text-mute font-bold border border-line rounded-sm px-2 py-0.5">
                        VS
                    </div>

                </div>

                <TeamSide ownTeam={ownTeam} recordsLoading={recordsLoading} recordsError={recordsError} record={records.find(r => r.rosterId === oppRoster?.roster_id)} league={league} navigate={navigate}
                    user={oppUser}
                    roster={oppRoster}
                    score={oppScore}
                    projFinal={oppProjFinal} isFinal={oppProj.isFinal}
                    isWinning={!winning && oppScore > 0}
                    mirror
                />
            </div>

            {!projectionsAvailable && (
                <p className="text-xs text-text-mute mt-3">{estimateUnavailableMessage([myProj, oppProj], projectionError, projectionsLoading)}</p>
            )}
            {gameError && projectionsAvailable && (
                    <p className="text-xs text-text-mute mt-3">Game clock update delayed; estimates use the last available clock.</p>
                )}
                {/* Win-prob bar */}
            <div className="mt-5 h-1.5 rounded-full overflow-hidden bg-bg-3">
                <div
                    className="h-full transition-[width] duration-base"
                    style={{
                        width: `${Math.round((winProb ?? 0) * 100)}%`,
                        background: 'linear-gradient(90deg, var(--signal), var(--good))',
                    }}
                />
            </div>
        </section>
    );
};

export default MyMatchupHero;
