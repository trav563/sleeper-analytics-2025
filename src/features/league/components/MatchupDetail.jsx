import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { LiveDot } from '../../../components/ui/LiveDot';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { computeWinProbability, formatWinProbabilityPercent } from '../../../lib/winProbability';
import { useGameLiveDetails } from '../../dashboard/hooks/useGameLiveDetails';
import { fetchLeagueMatchups } from '../../../utils/sleeper';
import { theme } from '../../../lib/theme';

/* ---------- helpers ---------- */
const buildPlayerSeasonAvg = (seasonMatchups) => {
    const totals = {};
    if (!seasonMatchups) return totals;
    Object.values(seasonMatchups).forEach((ms) => {
        if (!Array.isArray(ms)) return;
        ms.forEach((m) => {
            Object.entries(m.players_points || {}).forEach(([pid, pts]) => {
                if (!totals[pid]) totals[pid] = { sum: 0, n: 0 };
                if (pts > 0) {
                    totals[pid].sum += pts;
                    totals[pid].n += 1;
                }
            });
        });
    });
    const avg = {};
    Object.entries(totals).forEach(([pid, t]) => {
        avg[pid] = t.n > 0 ? t.sum / t.n : 0;
    });
    return avg;
};

const sumProjFromAvg = (starters, avgByPid) => {
    if (!Array.isArray(starters)) return 0;
    return starters.reduce((acc, pid) => {
        if (!pid || pid === '0') return acc;
        return acc + (avgByPid[pid] || 0);
    }, 0);
};

// Back-compat helper for callers that pass seasonMatchups directly.
const sumProjFromSeason = (starters, seasonMatchups) => {
    return sumProjFromAvg(starters, buildPlayerSeasonAvg(seasonMatchups));
};

const bucketStarter = (m, idx, players, gameStatuses) => {
    const pid = m.starters?.[idx];
    if (!pid || pid === '0') return { status: 'EMPTY', live: false };
    const player = players?.[pid];
    if (!player?.team) return { status: 'UNKNOWN', live: false };
    const gameStatus = gameStatuses[player.team];
    if (gameStatus === 'STATUS_FINAL') return { status: 'DONE', live: false };
    if (gameStatus === 'STATUS_IN_PROGRESS' || gameStatus === 'STATUS_HALFTIME') {
        return { status: 'LIVE', live: true };
    }
    return { status: 'SOON', live: false };
};

const orderedPositions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'K', 'DEF'];

/* ---------- main component ---------- */
const MatchupDetail = ({ league, rosters, users, players, week, currentNFLWeek, onWeekChange, viewMatchups, seasonMatchups, selectedRosterId, onSelectRoster }) => {
    const navigate = useNavigate();
    const [tab, setTab] = useState('side');
    const [seriesHistory, setSeriesHistory] = useState([]);

    const { details: liveDetails } = useGameLiveDetails(week);
    const gameStatuses = useMemo(() => {
        const map = {};
        Object.entries(liveDetails || {}).forEach(([abbr, d]) => {
            map[abbr] = d.statusName;
        });
        return map;
    }, [liveDetails]);

    /* Build the list of distinct matchup pairs this week for the picker. */
    const matchupPairs = useMemo(() => {
        if (!Array.isArray(viewMatchups) || !rosters) return [];
        const byId = new Map();
        viewMatchups.forEach((m) => {
            if (m.matchup_id == null) return;
            if (!byId.has(m.matchup_id)) byId.set(m.matchup_id, []);
            byId.get(m.matchup_id).push(m);
        });
        return Array.from(byId.values())
            .filter((pair) => pair.length === 2)
            .map(([a, b]) => {
                const ar = rosters.find((r) => r.roster_id === a.roster_id);
                const br = rosters.find((r) => r.roster_id === b.roster_id);
                const au = users?.find((u) => u.user_id === ar?.owner_id);
                const bu = users?.find((u) => u.user_id === br?.owner_id);
                return { a, b, ar, br, au, bu };
            })
            .sort((p, q) => (p.ar?.roster_id || 0) - (q.ar?.roster_id || 0));
    }, [viewMatchups, rosters, users]);

    /* Resolve the focus matchup from the selected roster id. */
    const { myRoster, myMatchup, oppRoster, oppMatchup, myUser, oppUser } = useMemo(() => {
        if (!viewMatchups || !rosters) return {};
        const myRoster =
            rosters.find((r) => r.roster_id === selectedRosterId) || rosters[0];
        if (!myRoster) return {};
        const myMatchup = viewMatchups.find((m) => m.roster_id === myRoster.roster_id);
        if (!myMatchup) return { myRoster };
        const oppMatchup = viewMatchups.find(
            (m) => m.matchup_id === myMatchup.matchup_id && m.roster_id !== myRoster.roster_id
        );
        const oppRoster = oppMatchup ? rosters.find((r) => r.roster_id === oppMatchup.roster_id) : null;
        const myUser = users?.find((u) => u.user_id === myRoster.owner_id);
        const oppUser = oppRoster ? users?.find((u) => u.user_id === oppRoster.owner_id) : null;
        return { myRoster, myMatchup, oppRoster, oppMatchup, myUser, oppUser };
    }, [viewMatchups, rosters, users, selectedRosterId]);

    /* Pull h2h history for these two rosters across the season (cheap — just iterate seasonMatchups). */
    const h2hHistory = useMemo(() => {
        if (!myRoster || !oppRoster || !seasonMatchups) return [];
        const out = [];
        Object.entries(seasonMatchups).forEach(([wk, ms]) => {
            if (!Array.isArray(ms)) return;
            const me = ms.find((m) => m.roster_id === myRoster.roster_id);
            const opp = ms.find((m) => m.roster_id === oppRoster.roster_id);
            if (me && opp && me.matchup_id === opp.matchup_id && me.matchup_id != null) {
                if ((me.points || 0) === 0 && (opp.points || 0) === 0) return;
                out.push({
                    week: Number(wk),
                    me: me.points || 0,
                    opp: opp.points || 0,
                });
            }
        });
        return out.sort((a, b) => a.week - b.week);
    }, [myRoster, oppRoster, seasonMatchups]);

    /* Optional: pull last season's matchups against same opponent (best-effort). */
    useEffect(() => {
        const prevLeagueId = league?.previous_league_id;
        if (!prevLeagueId || !myRoster || !oppRoster) return;
        let cancelled = false;
        (async () => {
            try {
                const recent = [];
                for (let w = 1; w <= 17; w++) {
                    const data = await fetchLeagueMatchups(prevLeagueId, w);
                    if (!Array.isArray(data)) continue;
                    const me = data.find((m) => m.roster_id === myRoster.roster_id);
                    const opp = data.find((m) => m.roster_id === oppRoster.roster_id);
                    if (me && opp && me.matchup_id === opp.matchup_id && me.matchup_id != null) {
                        if ((me.points || 0) === 0 && (opp.points || 0) === 0) continue;
                        recent.push({ season: 'prev', week: w, me: me.points || 0, opp: opp.points || 0 });
                    }
                }
                if (!cancelled) setSeriesHistory(recent);
            } catch (err) {
                if (!cancelled) console.warn('Failed to load prior season h2h', err);
            }
        })();
        return () => { cancelled = true; };
    }, [league?.previous_league_id, myRoster, oppRoster]);

    const allHistory = useMemo(
        () => [...seriesHistory, ...h2hHistory.filter((g) => g.week !== week)].slice(-4).reverse(),
        [seriesHistory, h2hHistory, week]
    );

    /* Slot labels (memoized so positionRows useMemo below has a stable dep). */
    const slotLabels = useMemo(() => league?.roster_positions || [], [league?.roster_positions]);

    /* Build position-by-position rows. Computed unconditionally so we don't
       trip rules-of-hooks; the early-return below skips the render. */
    const positionRows = useMemo(() => {
        if (!myMatchup) return [];
        const myStarters = myMatchup.starters || [];
        const oppStarters = oppMatchup?.starters || [];
        const myPoints = myMatchup.starters_points || [];
        const oppPoints = oppMatchup?.starters_points || [];
        const len = Math.max(myStarters.length, oppStarters.length, slotLabels.length);
        const rows = [];
        for (let i = 0; i < len; i++) {
            const slot = slotLabels[i] || '?';
            if (slot === 'BN' || slot === 'TAXI' || slot === 'IR') continue;
            const myPid = myStarters[i];
            const oppPid = oppStarters[i];
            const my = players?.[myPid];
            const opp = players?.[oppPid];
            const myStatus = bucketStarter(myMatchup, i, players, gameStatuses);
            const oppStatus = bucketStarter(oppMatchup, i, players, gameStatuses);
            rows.push({
                slot,
                me: my ? {
                    name: `${my.first_name} ${my.last_name}`,
                    team: my.team,
                    pts: myPoints[i] || 0,
                    status: myStatus.status,
                    live: myStatus.live,
                    pid: myPid,
                } : null,
                opp: opp ? {
                    name: `${opp.first_name} ${opp.last_name}`,
                    team: opp.team,
                    pts: oppPoints[i] || 0,
                    status: oppStatus.status,
                    live: oppStatus.live,
                    pid: oppPid,
                } : null,
            });
        }
        return rows.sort((a, b) => {
            const ai = orderedPositions.indexOf(a.slot);
            const bi = orderedPositions.indexOf(b.slot);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
    }, [myMatchup, oppMatchup, players, gameStatuses, slotLabels]);

    /* Per-player season-average map (built once) for fast projection lookups. */
    const playerAvg = useMemo(() => buildPlayerSeasonAvg(seasonMatchups), [seasonMatchups]);

    /* Win-probability checkpoint trajectory. Each checkpoint is one call to
       computeWinProbability with progressively more "actual" points and less
       "projected remaining" as starters' NFL games conclude. */
    const winProbCheckpoints = useMemo(() => {
        if (!myMatchup) return [];

        const myStarters = (myMatchup.starters || []).filter((p) => p && p !== '0');
        const oppStarters = (oppMatchup?.starters || []).filter((p) => p && p !== '0');
        const myPoints = myMatchup.starters_points || [];
        const oppPoints = oppMatchup?.starters_points || [];

        const myFullProj = sumProjFromAvg(myStarters, playerAvg);
        const oppFullProj = sumProjFromAvg(oppStarters, playerAvg);

        // Pregame checkpoint: predict purely from season averages.
        const pregameWP = computeWinProbability({
            myCurrent: 0,
            oppCurrent: 0,
            myProjRemaining: myFullProj,
            oppProjRemaining: oppFullProj,
        });
        const checkpoints = [{ label: 'Pregame', myWP: pregameWP }];

        // Map each starter to its NFL game (gameId, kickoff). Group by game so a
        // game's completion advances both teams' starters in that game at once.
        const gameMap = new Map(); // gameId -> { kickoff, statusName }
        const starterRefs = []; // { side, idx, pid, gameId, actualPts }
        const recordStarter = (side, idx, pid, actualPts) => {
            const team = players?.[pid]?.team;
            const live = team ? liveDetails?.[team] : null;
            const gameId = live?.gameId || `noGame:${pid}`;
            const kickoff = live?.kickoff || null;
            const statusName = live?.statusName || null;
            if (!gameMap.has(gameId)) gameMap.set(gameId, { kickoff, statusName });
            starterRefs.push({ side, idx, pid, gameId, actualPts });
        };
        myStarters.forEach((pid, i) => recordStarter('me', i, pid, myPoints[i] || 0));
        oppStarters.forEach((pid, i) => recordStarter('opp', i, pid, oppPoints[i] || 0));

        // Order completed games by kickoff so the checkpoint trail walks Thu → MNF.
        const completedGames = Array.from(gameMap.entries())
            .filter(([, g]) => g.statusName === 'STATUS_FINAL')
            .sort((a, b) => {
                const ta = a[1].kickoff ? Date.parse(a[1].kickoff) : 0;
                const tb = b[1].kickoff ? Date.parse(b[1].kickoff) : 0;
                return ta - tb;
            })
            .map(([gameId]) => gameId);

        if (completedGames.length === 0) {
            // No ESPN game-grouping available (true past-season case where ESPN
            // returns the wrong year's data). Fall back to per-starter
            // checkpoints using starters_points as proxy for "completed".
            const allStarters = [
                ...myStarters.map((pid, i) => ({ side: 'me', pid, pts: myPoints[i] || 0 })),
                ...oppStarters.map((pid, i) => ({ side: 'opp', pid, pts: oppPoints[i] || 0 })),
            ];
            const anyScored = allStarters.some((s) => s.pts > 0);
            if (!anyScored) return checkpoints; // truly no data — pregame only

            const finishedPids = new Set();
            allStarters.forEach((s) => {
                finishedPids.add(s.pid);
                let myActual = 0;
                let oppActual = 0;
                const myRemaining = [];
                const oppRemaining = [];
                myStarters.forEach((pid, i) => {
                    if (finishedPids.has(pid)) myActual += myPoints[i] || 0;
                    else myRemaining.push(pid);
                });
                oppStarters.forEach((pid, i) => {
                    if (finishedPids.has(pid)) oppActual += oppPoints[i] || 0;
                    else oppRemaining.push(pid);
                });
                const myProjRemaining = sumProjFromAvg(myRemaining, playerAvg);
                const oppProjRemaining = sumProjFromAvg(oppRemaining, playerAvg);
                const myWP = computeWinProbability({
                    myCurrent: myActual,
                    oppCurrent: oppActual,
                    myProjRemaining,
                    oppProjRemaining,
                });
                checkpoints.push({ label: `+${finishedPids.size}`, myWP });
            });
            return checkpoints;
        }

        const finishedGameIds = new Set();
        completedGames.forEach((gameId) => {
            finishedGameIds.add(gameId);
            let myActual = 0;
            let oppActual = 0;
            const myRemaining = [];
            const oppRemaining = [];
            starterRefs.forEach((s) => {
                if (finishedGameIds.has(s.gameId)) {
                    if (s.side === 'me') myActual += s.actualPts;
                    else oppActual += s.actualPts;
                } else {
                    if (s.side === 'me') myRemaining.push(s.pid);
                    else oppRemaining.push(s.pid);
                }
            });
            const myProjRemaining = sumProjFromAvg(myRemaining, playerAvg);
            const oppProjRemaining = sumProjFromAvg(oppRemaining, playerAvg);
            const myWP = computeWinProbability({
                myCurrent: myActual,
                oppCurrent: oppActual,
                myProjRemaining,
                oppProjRemaining,
            });
            checkpoints.push({ label: `+${finishedGameIds.size}`, myWP });
        });

        return checkpoints;
    }, [myMatchup, oppMatchup, players, liveDetails, playerAvg, week, currentNFLWeek]);

    /* No matchup found */
    if (!myMatchup) {
        return (
            <section className="space-y-3">
                <Back onClick={() => navigate(-1)} />
                <div className="bg-bg-1 rounded-xl border border-line p-8 shadow-card text-center">
                    <p className="font-display text-lg font-semibold text-text">No matchup found</p>
                    <p className="text-sm text-text-dim mt-1">
                        No matchup data for week <span className="tnum">{week}</span> yet.
                    </p>
                </div>
            </section>
        );
    }

    /* Score bookkeeping. */
    const myScore = myMatchup.points || 0;
    const oppScore = oppMatchup?.points || 0;

    /* Projected REMAINING (only for starters whose game isn't STATUS_FINAL). */
    const projRemaining = (m) => {
        if (!m) return 0;
        const remainingStarters = (m.starters || []).filter((pid, idx) => {
            const b = bucketStarter(m, idx, players, gameStatuses);
            return b.status !== 'DONE' && b.status !== 'EMPTY';
        });
        return sumProjFromSeason(remainingStarters, seasonMatchups);
    };
    const myProjRem = projRemaining(myMatchup);
    const oppProjRem = projRemaining(oppMatchup);
    const winProb = computeWinProbability({
        myCurrent: myScore,
        oppCurrent: oppScore,
        myProjRemaining: myProjRem,
        oppProjRemaining: oppProjRem,
    });
    const myProjFinal = myScore + myProjRem;
    const oppProjFinal = oppScore + oppProjRem;
    const margin = (myScore - oppScore).toFixed(1);

    const winning = myScore > oppScore;
    const remainingMine = (myMatchup.starters || []).filter((pid, idx) => {
        const b = bucketStarter(myMatchup, idx, players, gameStatuses);
        return b.status === 'LIVE' || b.status === 'SOON';
    }).length;
    const totalSlots = (myMatchup.starters || []).length;

    /* Live eyebrow text. */
    const anyLive = (myMatchup.starters || []).some((pid, idx) => {
        const b = bucketStarter(myMatchup, idx, players, gameStatuses);
        return b.status === 'LIVE';
    });

    // (slotLabels + positionRows now computed above the early return)

    const myHue = myRoster ? Number(myRoster.roster_id) * 47 % 360 : 0;
    const oppHue = oppRoster ? Number(oppRoster.roster_id) * 47 % 360 : 180;

    const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);

    return (
        <section className="space-y-5 pb-10">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Back onClick={() => navigate(-1)} />
                {onWeekChange && (
                    <label className="inline-flex items-center gap-2 bg-bg-2 px-2.5 py-1 rounded-md border border-line">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Week</span>
                        <select
                            className="bg-transparent text-sm font-semibold text-text border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pr-6 tnum"
                            value={week}
                            onChange={(e) => onWeekChange(e.target.value)}
                        >
                            {weekOptions.map((w) => (
                                <option key={w} value={w}>
                                    {w}{currentNFLWeek && w === currentNFLWeek ? ' (Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            {/* Matchup picker — horizontal scroll of all pairs this week */}
            {matchupPairs.length > 1 && (
                <div className="space-y-2">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        Week <span className="tnum text-text-dim">{week}</span> · {matchupPairs.length} matchups
                    </div>
                    <div
                        className="flex gap-2 overflow-x-auto pb-1"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {matchupPairs.map((p) => {
                            const isActive = p.ar?.roster_id === myRoster?.roster_id || p.br?.roster_id === myRoster?.roster_id;
                            const aWin = (p.a.points || 0) > (p.b.points || 0);
                            return (
                                <button
                                    key={p.a.matchup_id}
                                    type="button"
                                    onClick={() => onSelectRoster?.(p.ar?.roster_id)}
                                    className={`shrink-0 min-w-[200px] rounded-md border p-2.5 text-left transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                                        isActive
                                            ? 'bg-bg-2 border-signal'
                                            : 'bg-bg-1 border-line hover:border-line-strong hover:bg-bg-2/60'
                                    }`}
                                    aria-pressed={isActive}
                                >
                                    <PairRow
                                        roster={p.ar}
                                        user={p.au}
                                        score={p.a.points || 0}
                                        winning={aWin}
                                    />
                                    <PairRow
                                        roster={p.br}
                                        user={p.bu}
                                        score={p.b.points || 0}
                                        winning={!aWin}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Hero ribbon */}
            <header
                className="rounded-xl border border-line p-5 md:p-6 shadow-card"
                style={{
                    background: `
                        radial-gradient(circle at 10% 0%, oklch(62% 0.18 ${myHue} / 0.25), transparent 50%),
                        radial-gradient(circle at 90% 100%, oklch(62% 0.18 ${oppHue} / 0.2), transparent 50%),
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
                                Week <span className="tnum">{week}</span>
                            </span>
                        )}
                    </div>
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                        <span className="tnum">{remainingMine}</span> of <span className="tnum">{totalSlots}</span> players remaining
                    </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-6 items-center">
                    {/* My side */}
                    <div className="text-center md:text-left flex flex-col items-center md:flex-row md:items-center gap-2 md:gap-5 min-w-0">
                        <button
                            type="button"
                            onClick={() => myRoster && navigate(`/league/${league?.league_id}/team/${myRoster.roster_id}`)}
                            className="shrink-0 rounded-full transition-all hover:ring-2 hover:ring-signal/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                            aria-label={`View ${displayTeamName(myUser)}`}
                        >
                            {myUser?.avatar ? (
                                <img src={avatarUrl(myUser.avatar)} alt="" className="w-12 h-12 md:w-20 md:h-20 rounded-full ring-1 ring-line" />
                            ) : (
                                <Pip seed={myRoster?.roster_id} name={displayTeamName(myUser)} size={48} />
                            )}
                        </button>
                        <div className="min-w-0">
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                                {myRoster?.settings?.wins ?? 0}-{myRoster?.settings?.losses ?? 0} · You
                            </div>
                            <button
                                type="button"
                                onClick={() => myRoster && navigate(`/league/${league?.league_id}/team/${myRoster.roster_id}`)}
                                className="block font-display text-sm md:text-lg font-bold text-text truncate max-w-[140px] md:max-w-[320px] mx-auto md:mx-0 hover:text-signal transition-colors duration-fast md:text-left"
                            >
                                {displayTeamName(myUser)}
                            </button>
                            <div
                                className={`tnum font-display text-4xl md:text-6xl font-extrabold tracking-tight leading-none mt-2 ${winning ? 'text-signal' : 'text-text'}`}
                                style={winning ? { textShadow: '0 0 24px rgba(245,179,1,0.33)' } : undefined}
                            >
                                {myScore.toFixed(1)}
                            </div>
                            <div className="font-mono text-2xs text-text-mute mt-1.5">
                                Proj <span className="tnum">{myProjFinal.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Center pod */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="px-2 md:px-3 py-2 rounded-md bg-bg-2 border border-line text-center min-w-[68px] md:min-w-[100px]">
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">
                                Win Prob
                            </div>
                            <div className="font-display tnum text-2xl font-extrabold text-good">
                                {formatWinProbabilityPercent(winProb)}
                            </div>
                        </div>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                            Margin <span className={`tnum font-bold ${winning ? 'text-good' : 'text-bad'}`}>
                                {Number(margin) >= 0 ? '+' : ''}{margin}
                            </span>
                        </div>
                    </div>

                    {/* Opp side */}
                    <div className="text-center md:text-right flex flex-col items-center md:flex-row-reverse md:items-center gap-2 md:gap-5 min-w-0">
                        <button
                            type="button"
                            onClick={() => oppRoster && navigate(`/league/${league?.league_id}/team/${oppRoster.roster_id}`)}
                            className="shrink-0 rounded-full transition-all hover:ring-2 hover:ring-signal/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                            aria-label={`View ${displayTeamName(oppUser)}`}
                        >
                            {oppUser?.avatar ? (
                                <img src={avatarUrl(oppUser.avatar)} alt="" className="w-12 h-12 md:w-20 md:h-20 rounded-full ring-1 ring-line" />
                            ) : (
                                <Pip seed={oppRoster?.roster_id} name={displayTeamName(oppUser)} size={48} />
                            )}
                        </button>
                        <div className="min-w-0">
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                                {oppRoster?.settings?.wins ?? 0}-{oppRoster?.settings?.losses ?? 0} · Opp
                            </div>
                            <button
                                type="button"
                                onClick={() => oppRoster && navigate(`/league/${league?.league_id}/team/${oppRoster.roster_id}`)}
                                className="block font-display text-sm md:text-lg font-bold text-text truncate max-w-[140px] md:max-w-[320px] mx-auto md:mx-0 md:ml-auto hover:text-signal transition-colors duration-fast md:text-right"
                            >
                                {displayTeamName(oppUser)}
                            </button>
                            <div
                                className={`tnum font-display text-4xl md:text-6xl font-extrabold tracking-tight leading-none mt-2 ${!winning ? 'text-signal' : 'text-text'}`}
                                style={!winning ? { textShadow: '0 0 24px rgba(245,179,1,0.33)' } : undefined}
                            >
                                {oppScore.toFixed(1)}
                            </div>
                            <div className="font-mono text-2xs text-text-mute mt-1.5">
                                Proj <span className="tnum">{oppProjFinal.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Win-prob bar */}
                <div className="mt-5 h-1.5 rounded-full overflow-hidden bg-bg-3">
                    <div
                        className="h-full"
                        style={{
                            width: `${Math.round(winProb * 100)}%`,
                            background: `linear-gradient(90deg, var(--signal), var(--good))`,
                        }}
                    />
                </div>
            </header>

            {/* Tabs */}
            <SegmentedTabs
                tabs={[
                    { value: 'side', label: 'Side by Side' },
                    { value: 'box', label: 'Box Score' },
                    { value: 'history', label: 'History' },
                ]}
                value={tab}
                onChange={setTab}
                className="max-w-md"
            />

            {/* Body: position-by-position table */}
            {tab === 'side' && (
                <div className="grid lg:grid-cols-[1fr_360px] gap-4">
                    <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
                        <div>
                            {positionRows.map((row, i) => {
                                const meWin = (row.me?.pts || 0) > (row.opp?.pts || 0);
                                const oppWin = (row.opp?.pts || 0) > (row.me?.pts || 0);
                                return (
                                    <div
                                        key={i}
                                        className="grid grid-cols-[1fr_60px_1fr] gap-2 md:gap-4 items-center px-4 py-3 border-b border-line last:border-0"
                                    >
                                        <PlayerCell side="me" player={row.me} winning={meWin} navigate={navigate} leagueId={league?.league_id} />
                                        <div className="text-center">
                                            <div className="font-mono text-2xs font-bold tracking-wider uppercase text-signal bg-signal/15 px-2 py-0.5 rounded-sm inline-block">
                                                {row.slot}
                                            </div>
                                            <div className={`font-mono text-2xs font-bold tnum mt-1 ${meWin ? 'text-good' : oppWin ? 'text-bad' : 'text-text-mute'}`}>
                                                {meWin ? '+' : oppWin ? '−' : ''}
                                                {Math.abs((row.me?.pts || 0) - (row.opp?.pts || 0)).toFixed(1)}
                                            </div>
                                        </div>
                                        <PlayerCell side="opp" player={row.opp} winning={oppWin} navigate={navigate} leagueId={league?.league_id} />
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Side rail */}
                    <aside className="space-y-4 min-w-0">
                        <SectionShell title="Totals">
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <Stat label="Current" value={`${myScore.toFixed(1)} – ${oppScore.toFixed(1)}`} />
                                <Stat label="Projected" value={`${myProjFinal.toFixed(1)} – ${oppProjFinal.toFixed(1)}`} />
                                <Stat label="Margin" value={(Number(margin) >= 0 ? '+' : '') + margin} tone={Number(margin) >= 0 ? 'good' : 'bad'} />
                            </div>
                        </SectionShell>

                        <SectionShell
                            title="Win Probability"
                            sub={anyLive
                                ? `Live · ${winProbCheckpoints.length} checkpoints`
                                : winProbCheckpoints.length <= 1 ? 'Pregame · projection-based' : `${winProbCheckpoints.length} checkpoints`}
                        >
                            <WinProbCurve
                                checkpoints={winProbCheckpoints}
                                winProb={winProb}
                                myName={displayTeamName(myUser)}
                                oppName={displayTeamName(oppUser)}
                                myHue={myHue}
                                oppHue={oppHue}
                            />
                        </SectionShell>
                    </aside>
                </div>
            )}

            {tab === 'box' && (
                <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card">
                    <header className="font-display text-md font-semibold text-text mb-3">Box Score</header>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2 text-left">
                                    <th className="px-2 py-2">Slot</th>
                                    <th className="px-2 py-2">Player</th>
                                    <th className="px-2 py-2 text-right">Pts</th>
                                    <th className="px-2 py-2">vs</th>
                                    <th className="px-2 py-2">Player</th>
                                    <th className="px-2 py-2 text-right">Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positionRows.map((row, i) => (
                                    <tr key={i} className="border-b border-line/60 last:border-0">
                                        <td className="px-2 py-2 font-mono text-2xs uppercase tracking-wider text-signal">{row.slot}</td>
                                        <td className="px-2 py-2 text-text truncate">{row.me?.name || '—'}</td>
                                        <td className={`px-2 py-2 text-right tnum font-semibold ${(row.me?.pts || 0) > (row.opp?.pts || 0) ? 'text-good' : 'text-text'}`}>
                                            {(row.me?.pts || 0).toFixed(1)}
                                        </td>
                                        <td className="px-2 py-2 font-mono text-2xs uppercase text-text-mute">vs</td>
                                        <td className="px-2 py-2 text-text truncate">{row.opp?.name || '—'}</td>
                                        <td className={`px-2 py-2 text-right tnum font-semibold ${(row.opp?.pts || 0) > (row.me?.pts || 0) ? 'text-good' : 'text-text'}`}>
                                            {(row.opp?.pts || 0).toFixed(1)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {tab === 'history' && (
                <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card">
                    <header className="font-display text-md font-semibold text-text mb-3">Head-to-Head History</header>
                    {allHistory.length === 0 ? (
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                            No prior meetings on record yet.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {allHistory.map((g, i) => {
                                const meWin = g.me > g.opp;
                                return (
                                    <li key={i} className="grid grid-cols-[80px_1fr_1fr] items-center gap-3 border-b border-line/60 last:border-0 pb-2 last:pb-0">
                                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute tnum">
                                            {g.season || (league?.season || '')} W{g.week}
                                        </span>
                                        <span className={`text-sm tnum text-right ${meWin ? 'text-signal font-bold' : 'text-text-dim'}`}>
                                            {g.me.toFixed(1)}
                                        </span>
                                        <span className={`text-sm tnum ${!meWin ? 'text-signal-2 font-bold' : 'text-text-dim'}`}>
                                            <span className="text-text-mute mr-1">·</span> {g.opp.toFixed(1)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}
        </section>
    );
};

/* -- presentational helpers -- */
const PairRow = ({ roster, user, score, winning }) => (
    <div className="grid grid-cols-[20px_1fr_auto] gap-2 items-center py-0.5">
        {user?.avatar ? (
            <img src={avatarUrl(user.avatar)} alt="" className="w-5 h-5 rounded-full ring-1 ring-line shrink-0" />
        ) : (
            <Pip seed={roster?.roster_id} name={displayTeamName(user)} size={20} />
        )}
        <span className={`text-xs truncate ${winning ? 'text-text font-semibold' : 'text-text-dim'}`}>
            {displayTeamName(user)}
        </span>
        <span className={`tnum text-sm font-bold tracking-tight ${winning ? 'text-signal' : 'text-text'}`}>
            {score.toFixed(1)}
        </span>
    </div>
);

const Back = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-text-dim hover:text-signal text-xs font-mono uppercase tracking-wider transition-colors duration-fast"
    >
        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
    </button>
);

const PlayerCell = ({ side, player, winning, navigate, leagueId }) => {
    if (!player) {
        return <div className={`text-${side === 'me' ? 'right' : 'left'} text-text-mute text-sm italic`}>Empty</div>;
    }
    return (
        <button
            type="button"
            onClick={() => navigate(`/league/${leagueId}/player/${player.pid}`)}
            className={`min-w-0 ${side === 'me' ? 'text-right' : 'text-left'} group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal rounded-sm`}
        >
            <div className="text-sm font-semibold text-text truncate group-hover:text-signal transition-colors duration-fast">
                {player.name}
            </div>
            <div className={`font-mono text-2xs uppercase tracking-wider ${player.live ? 'text-signal-2' : 'text-text-mute'}`}>
                {player.live && '● '}{player.team || '—'} · {player.status}
            </div>
            <div className={`tnum text-lg font-extrabold tracking-tight mt-0.5 ${winning ? 'text-good' : 'text-text'}`}>
                {(player.pts || 0).toFixed(1)}
            </div>
        </button>
    );
};

const SectionShell = ({ title, sub, children }) => (
    <section className="bg-bg-1 rounded-xl border border-line p-4 shadow-card">
        <header className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-md font-semibold text-text">{title}</h3>
            {sub && <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{sub}</span>}
        </header>
        {children}
    </section>
);

const Stat = ({ label, value, tone }) => {
    const t = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-text';
    return (
        <div>
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">{label}</div>
            <div className={`tnum font-display text-md font-bold ${t} mt-0.5`}>{value}</div>
        </div>
    );
};

const WinProbCurve = ({ checkpoints = [], winProb, myName, oppName, myHue = 45, oppHue = 200 }) => {
    const myColor = `oklch(72% 0.16 ${myHue})`;
    const oppColor = `oklch(72% 0.16 ${oppHue})`;
    const W = 320;
    const H = 100;

    // Build polyline points from checkpoints. Single checkpoint (pregame only)
    // renders as just two pips so the user sees "this is the prediction, no data yet".
    const myPoints = checkpoints.map((c, i) => {
        const x = checkpoints.length > 1 ? (i / (checkpoints.length - 1)) * W : W / 2;
        const y = H - c.myWP * H;
        return [x, y];
    });
    const oppPoints = checkpoints.map((c, i) => {
        const x = checkpoints.length > 1 ? (i / (checkpoints.length - 1)) * W : W / 2;
        const y = H - (1 - c.myWP) * H;
        return [x, y];
    });
    const toPath = (pts) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

    const lastIdx = checkpoints.length - 1;
    const lastMyWP = lastIdx >= 0 ? checkpoints[lastIdx].myWP : (winProb ?? 0.5);
    const lastOppWP = 1 - lastMyWP;

    return (
        <>
            <svg viewBox={`0 0 ${W} ${H + 10}`} width="100%" height="110" preserveAspectRatio="none">
                <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke={theme.color.line} strokeDasharray="2 3" />
                {checkpoints.length > 1 && (
                    <>
                        <path d={toPath(oppPoints)} fill="none" stroke={oppColor} strokeWidth="2" strokeOpacity="0.85" />
                        <path d={toPath(myPoints)} fill="none" stroke={myColor} strokeWidth="2.5" />
                    </>
                )}
                {myPoints.map(([x, y], i) => (
                    <circle key={`m${i}`} cx={x} cy={y} r={i === lastIdx ? 4 : 2.5} fill={myColor} />
                ))}
                {oppPoints.map(([x, y], i) => (
                    <circle key={`o${i}`} cx={x} cy={y} r={i === lastIdx ? 3.5 : 2} fill={oppColor} />
                ))}
            </svg>
            {checkpoints.length > 1 && (
                <div className="flex justify-between font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    {checkpoints.map((c, i) => (
                        <span key={i} className="tnum">{c.label}</span>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 font-mono text-2xs">
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded-sm" style={{ background: myColor }} />
                    <span className="text-text truncate max-w-[120px]">{myName || 'You'}</span>
                    <span className="tnum text-text-dim">{Math.round(lastMyWP * 100)}%</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded-sm" style={{ background: oppColor }} />
                    <span className="text-text truncate max-w-[120px]">{oppName || 'Opp'}</span>
                    <span className="tnum text-text-dim">{Math.round(lastOppWP * 100)}%</span>
                </span>
            </div>
        </>
    );
};

export default MatchupDetail;
