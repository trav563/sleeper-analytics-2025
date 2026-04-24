import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { LiveDot } from '../../../components/ui/LiveDot';
import { computeWinProbability, formatWinProbabilityPercent } from '../../../lib/winProbability';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';

const ROSTER_HUE = (rosterId) => (Number(rosterId || 0) * 47) % 360;

/**
 * Hero matchup card for the dashboard. Mirrors the design's
 * dir-a.jsx MyMatchupHero composition (large pip, full team name,
 * 72px score with glow, PROJ · CEILING sub, win-prob bar at bottom).
 */
const MyMatchupHero = ({ league, week, viewMatchups, rosters, users, players, seasonMatchups, selectedUserId }) => {
    const navigate = useNavigate();
    const { details: liveDetails } = useGameLiveDetails(week);

    const { myRoster, myMatchup, oppRoster, oppMatchup, myUser, oppUser } = useMemo(() => {
        if (!Array.isArray(viewMatchups) || !rosters) return {};
        const me = rosters.find((r) => r.owner_id === selectedUserId) || rosters[0];
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
    }, [viewMatchups, rosters, users, selectedUserId]);

    const myHue = ROSTER_HUE(myRoster?.roster_id);
    const oppHue = ROSTER_HUE(oppRoster?.roster_id) || 180;

    /* Per-player season aggregates: avg + max single-week score (for CEILING). */
    const playerStats = useMemo(() => {
        const out = {};
        if (!seasonMatchups) return out;
        Object.values(seasonMatchups).forEach((ms) => {
            if (!Array.isArray(ms)) return;
            ms.forEach((m) => {
                Object.entries(m.players_points || {}).forEach(([pid, pts]) => {
                    if (!out[pid]) out[pid] = { sum: 0, n: 0, max: 0 };
                    if (pts > 0) {
                        out[pid].sum += pts;
                        out[pid].n += 1;
                        if (pts > out[pid].max) out[pid].max = pts;
                    }
                });
            });
        });
        return out;
    }, [seasonMatchups]);

    if (!myMatchup) {
        return (
            <section
                className="rounded-xl border border-line p-5 shadow-card"
                style={{ background: `radial-gradient(circle at 0% 0%, oklch(62% 0.18 ${myHue} / 0.18), transparent 55%), var(--bg-1)` }}
            >
                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    No matchup data for week <span className="tnum">{week}</span>
                </div>
            </section>
        );
    }

    /* Score bookkeeping. */
    const myScore = myMatchup.points || 0;
    const oppScore = oppMatchup?.points || 0;
    const winning = myScore > oppScore;

    /* Projected REMAINING + CEILING REMAINING per side. */
    const computeProj = (m) => {
        if (!m) return { proj: 0, ceiling: 0 };
        let proj = 0;
        let ceiling = 0;
        (m.starters || []).forEach((pid) => {
            if (!pid || pid === '0') return;
            const team = players?.[pid]?.team;
            const status = team ? liveDetails?.[team]?.statusName : null;
            const isDone = status === 'STATUS_FINAL';
            if (isDone) return;
            const stats = playerStats[pid];
            if (!stats || stats.n === 0) return;
            proj += stats.sum / stats.n;
            ceiling += stats.max;
        });
        return { proj, ceiling };
    };
    const myProj = computeProj(myMatchup);
    const oppProj = computeProj(oppMatchup);
    const myProjFinal = myScore + myProj.proj;
    const oppProjFinal = oppScore + oppProj.proj;
    const myCeilFinal = myScore + myProj.ceiling;
    const oppCeilFinal = oppScore + oppProj.ceiling;
    const winProb = computeWinProbability({
        myCurrent: myScore,
        oppCurrent: oppScore,
        myProjRemaining: myProj.proj,
        oppProjRemaining: oppProj.proj,
    });

    /* Live eyebrow. */
    const anyLive = (myMatchup.starters || []).some((pid) => {
        const team = players?.[pid]?.team;
        const status = team ? liveDetails?.[team]?.statusName : null;
        return status === 'STATUS_IN_PROGRESS' || status === 'STATUS_HALFTIME';
    });
    const remainingMine = (myMatchup.starters || []).filter((pid) => {
        const team = players?.[pid]?.team;
        const status = team ? liveDetails?.[team]?.statusName : null;
        return status !== 'STATUS_FINAL' && status !== null;
    }).length;
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

    /* Renders one side of the hero (mirror = right side, desktop only). */
    const TeamSide = ({ user, roster, score, projFinal, ceilFinal, isWinning, mirror = false }) => {
        const recordLabel = roster
            ? `${roster.settings?.wins ?? 0}-${roster.settings?.losses ?? 0} · ${mirror ? 'Opp' : 'You'}`
            : (mirror ? 'Opp' : 'You');
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
                <div className="min-w-0">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-dim font-bold">
                        {recordLabel}
                    </div>
                    <button
                        type="button"
                        onClick={goTeam}
                        className={`block font-display text-sm md:text-xl font-bold tracking-snug text-text truncate max-w-[140px] md:max-w-[280px] mx-auto hover:text-signal transition-colors duration-fast ${mirror ? 'md:ml-auto md:mx-0 md:text-right' : 'md:mx-0 md:text-left'}`}
                    >
                        {displayTeamName(user)}
                    </button>
                    <div
                        className={`tnum font-display text-4xl md:text-[72px] font-extrabold tracking-tight leading-none mt-1 ${isWinning ? 'text-signal' : 'text-text'}`}
                        style={isWinning ? { textShadow: '0 0 28px rgba(245,179,1,0.33)' } : undefined}
                    >
                        {score.toFixed(1)}
                    </div>
                    <div className="font-mono text-2xs text-text-dim mt-1">
                        Proj <span className="tnum text-text-dim">{projFinal.toFixed(1)}</span>
                        {ceilFinal > projFinal && (
                            <> · Ceiling <span className="tnum text-text-dim">{ceilFinal.toFixed(1)}</span></>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const goMatchup = () => navigate(`/league/${league?.league_id}/matchup`);
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={goMatchup}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goMatchup(); } }}
            className="cursor-pointer w-full text-left rounded-xl border border-line p-5 md:p-6 shadow-card relative overflow-hidden transition-colors duration-fast hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
            style={{
                background: `
                    radial-gradient(circle at 10% 0%, oklch(62% 0.18 ${myHue} / 0.32), transparent 55%),
                    radial-gradient(circle at 90% 100%, oklch(62% 0.18 ${oppHue} / 0.25), transparent 55%),
                    var(--bg-1)
                `,
            }}
        >
            {/* Eyebrow */}
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-2">
                    {anyLive ? (
                        <>
                            <LiveDot />
                            <span className="font-mono text-2xs uppercase tracking-wider font-bold text-signal-2">
                                Live · Week <span className="tnum">{week}</span> Matchup
                            </span>
                        </>
                    ) : (
                        <span className="font-mono text-2xs uppercase tracking-wider font-bold text-text-mute">
                            Week <span className="tnum">{week}</span> Matchup
                        </span>
                    )}
                </div>
                <span className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                    {liveTime && <><span className="text-text-dim tnum">{liveTime}</span> · </>}
                    <span className="tnum">{remainingMine}</span> players left
                </span>
            </div>

            {/* Teams + center pod */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-6 items-center">
                <TeamSide
                    user={myUser}
                    roster={myRoster}
                    score={myScore}
                    projFinal={myProjFinal}
                    ceilFinal={myCeilFinal}
                    isWinning={winning && myScore > 0}
                />

                <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold border border-line rounded-sm px-2 py-0.5">
                        VS
                    </div>
                    <div className="px-2 md:px-3 py-1.5 rounded-md bg-bg-3 border border-line text-center min-w-[68px] md:min-w-[88px]">
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">
                            Win Prob
                        </div>
                        <div className="font-display tnum text-xl font-extrabold text-good leading-none mt-0.5">
                            {formatWinProbabilityPercent(winProb)}
                        </div>
                    </div>
                </div>

                <TeamSide
                    user={oppUser}
                    roster={oppRoster}
                    score={oppScore}
                    projFinal={oppProjFinal}
                    ceilFinal={oppCeilFinal}
                    isWinning={!winning && oppScore > 0}
                    mirror
                />
            </div>

            {/* Win-prob bar */}
            <div className="mt-5 h-1.5 rounded-full overflow-hidden bg-bg-3">
                <div
                    className="h-full transition-[width] duration-base"
                    style={{
                        width: `${Math.round(winProb * 100)}%`,
                        background: 'linear-gradient(90deg, var(--signal), var(--good))',
                    }}
                />
            </div>
        </div>
    );
};

export default MyMatchupHero;
