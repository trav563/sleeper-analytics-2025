import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { LiveDot } from '../../../components/ui/LiveDot';
import { computeWinProbability, formatWinProbabilityPercent } from '../../../lib/winProbability';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';

const ROSTER_HUE = (rosterId) => (Number(rosterId || 0) * 47) % 360;

/**
 * Hero matchup card for the dashboard. Pulls the user's matchup pair
 * out of the week's matchups, computes win prob from current + projected,
 * mirrors the dir-a.jsx MyMatchupHero composition.
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

    /* Projected REMAINING for live-aware win prob. */
    const seasonAvg = (pid) => {
        if (!pid || pid === '0' || !seasonMatchups) return 0;
        let sum = 0, n = 0;
        Object.values(seasonMatchups).forEach((ms) => {
            if (!Array.isArray(ms)) return;
            ms.forEach((m) => {
                const pts = m.players_points?.[pid];
                if (pts != null && pts > 0) { sum += pts; n += 1; }
            });
        });
        return n > 0 ? sum / n : 0;
    };
    const projRemaining = (m) => {
        if (!m) return 0;
        return (m.starters || []).reduce((acc, pid) => {
            const team = players?.[pid]?.team;
            const status = team ? liveDetails?.[team]?.statusName : null;
            const isDone = status === 'STATUS_FINAL';
            return acc + (isDone ? 0 : seasonAvg(pid));
        }, 0);
    };
    const myProjRem = projRemaining(myMatchup);
    const oppProjRem = projRemaining(oppMatchup);
    const myScore = myMatchup.points || 0;
    const oppScore = oppMatchup?.points || 0;
    const winProb = computeWinProbability({
        myCurrent: myScore,
        oppCurrent: oppScore,
        myProjRemaining: myProjRem,
        oppProjRemaining: oppProjRem,
    });
    const winning = myScore > oppScore;

    const anyLive = (myMatchup.starters || []).some((pid) => {
        const team = players?.[pid]?.team;
        const status = team ? liveDetails?.[team]?.statusName : null;
        return status === 'STATUS_IN_PROGRESS' || status === 'STATUS_HALFTIME';
    });
    const remainingMine = (myMatchup.starters || []).filter((pid) => {
        const team = players?.[pid]?.team;
        const status = team ? liveDetails?.[team]?.statusName : null;
        return status !== 'STATUS_FINAL';
    }).length;

    return (
        <button
            type="button"
            onClick={() => navigate(`/league/${league?.league_id}/matchup`)}
            className="w-full text-left rounded-xl border border-line p-5 md:p-6 shadow-card relative overflow-hidden transition-colors duration-fast hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
            style={{
                background: `
                    radial-gradient(circle at 10% 0%, oklch(62% 0.18 ${myHue} / 0.32), transparent 55%),
                    radial-gradient(circle at 90% 100%, oklch(62% 0.18 ${oppHue} / 0.25), transparent 55%),
                    var(--bg-1)
                `,
            }}
        >
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                    {anyLive ? (
                        <>
                            <LiveDot />
                            <span className="font-mono text-2xs uppercase tracking-wider font-bold text-signal-2">
                                Live · Week <span className="tnum">{week}</span>
                            </span>
                        </>
                    ) : (
                        <span className="font-mono text-2xs uppercase tracking-wider font-bold text-text-mute">
                            Week <span className="tnum">{week}</span> Matchup
                        </span>
                    )}
                </div>
                <span className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                    <span className="tnum">{remainingMine}</span> left
                </span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 md:gap-6 items-center">
                {/* My side */}
                <div className="text-center flex flex-col items-center gap-2">
                    {myUser?.avatar ? (
                        <img src={avatarUrl(myUser.avatar)} alt="" className="w-12 h-12 md:w-14 md:h-14 rounded-full ring-1 ring-line" />
                    ) : (
                        <Pip seed={myRoster?.roster_id} name={displayTeamName(myUser)} size={48} />
                    )}
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-dim">You</div>
                    <div
                        className={`tnum font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-none ${winning ? 'text-signal' : 'text-text'}`}
                        style={winning ? { textShadow: '0 0 24px rgba(245,179,1,0.33)' } : undefined}
                    >
                        {myScore.toFixed(1)}
                    </div>
                    <div className="font-mono text-2xs text-text-mute">
                        Proj <span className="tnum">{(myScore + myProjRem).toFixed(1)}</span>
                    </div>
                </div>

                {/* Center pod */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold border border-line rounded-sm px-2 py-0.5">
                        VS
                    </div>
                    <div className="text-center mt-1">
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">Win</div>
                        <div className="font-display tnum text-md font-extrabold text-good">
                            {formatWinProbabilityPercent(winProb)}
                        </div>
                    </div>
                </div>

                {/* Opp side */}
                <div className="text-center flex flex-col items-center gap-2">
                    {oppUser?.avatar ? (
                        <img src={avatarUrl(oppUser.avatar)} alt="" className="w-12 h-12 md:w-14 md:h-14 rounded-full ring-1 ring-line" />
                    ) : (
                        <Pip seed={oppRoster?.roster_id} name={displayTeamName(oppUser)} size={48} />
                    )}
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-dim truncate max-w-[120px]">
                        {oppUser ? displayTeamName(oppUser).split(' ')[0] : 'Opp'}
                    </div>
                    <div
                        className={`tnum font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-none ${!winning && oppScore > 0 ? 'text-signal' : 'text-text'}`}
                        style={!winning && oppScore > 0 ? { textShadow: '0 0 24px rgba(245,179,1,0.33)' } : undefined}
                    >
                        {oppScore.toFixed(1)}
                    </div>
                    <div className="font-mono text-2xs text-text-mute">
                        Proj <span className="tnum">{(oppScore + oppProjRem).toFixed(1)}</span>
                    </div>
                </div>
            </div>

            {/* Win-prob bar */}
            <div className="mt-4 h-1 rounded-full overflow-hidden bg-bg-3">
                <div
                    className="h-full transition-[width] duration-base"
                    style={{
                        width: `${Math.round(winProb * 100)}%`,
                        background: 'linear-gradient(90deg, var(--signal), var(--good))',
                    }}
                />
            </div>
        </button>
    );
};

export default MyMatchupHero;
