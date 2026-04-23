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
const sumProjFromSeason = (starters, seasonMatchups) => {
    if (!Array.isArray(starters) || !seasonMatchups) return 0;
    // For each starter, average their non-zero weeks → that's the proj.
    const totals = {};
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
    return starters.reduce((acc, pid) => {
        if (!pid || pid === '0') return acc;
        const t = totals[pid];
        return acc + (t && t.n > 0 ? t.sum / t.n : 0);
    }, 0);
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
const MatchupDetail = ({ league, rosters, users, players, week, viewMatchups, seasonMatchups, currentUserId }) => {
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

    /* Pick the current user's matchup pair (or first matchup if no user). */
    const { myRoster, myMatchup, oppRoster, oppMatchup, myUser, oppUser } = useMemo(() => {
        if (!viewMatchups || !rosters) return {};
        const myRoster = rosters.find((r) => r.owner_id === currentUserId) || rosters[0];
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
    }, [viewMatchups, rosters, users, currentUserId]);

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

    /* Slot labels — derive from league.roster_positions if available. */
    const slotLabels = league?.roster_positions || [];

    /* Build position-by-position rows. */
    const positionRows = useMemo(() => {
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
        // Sort by canonical position order
        return rows.sort((a, b) => {
            const ai = orderedPositions.indexOf(a.slot);
            const bi = orderedPositions.indexOf(b.slot);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
    }, [myMatchup, oppMatchup, players, gameStatuses, slotLabels]);

    const myHue = myRoster ? Number(myRoster.roster_id) * 47 % 360 : 0;
    const oppHue = oppRoster ? Number(oppRoster.roster_id) * 47 % 360 : 180;

    return (
        <section className="space-y-5 pb-10">
            <Back onClick={() => navigate(-1)} />

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

                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 md:gap-6 items-center">
                    {/* My side */}
                    <div className="text-center md:text-left flex flex-col md:flex-row items-center md:items-center gap-3 md:gap-5">
                        {myUser?.avatar ? (
                            <img src={avatarUrl(myUser.avatar)} alt="" className="w-14 h-14 md:w-20 md:h-20 rounded-full ring-1 ring-line shrink-0" />
                        ) : (
                            <Pip seed={myRoster?.roster_id} name={displayTeamName(myUser)} size={56} />
                        )}
                        <div className="min-w-0">
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                                {myRoster?.settings?.wins ?? 0}-{myRoster?.settings?.losses ?? 0} · You
                            </div>
                            <div className="font-display text-md md:text-lg font-bold text-text truncate max-w-[280px] md:max-w-[320px]">
                                {displayTeamName(myUser)}
                            </div>
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
                        <div className="px-3 py-2 rounded-md bg-bg-2 border border-line text-center min-w-[100px]">
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
                    <div className="text-center md:text-right flex flex-col md:flex-row-reverse items-center md:items-center gap-3 md:gap-5">
                        {oppUser?.avatar ? (
                            <img src={avatarUrl(oppUser.avatar)} alt="" className="w-14 h-14 md:w-20 md:h-20 rounded-full ring-1 ring-line shrink-0" />
                        ) : (
                            <Pip seed={oppRoster?.roster_id} name={displayTeamName(oppUser)} size={56} />
                        )}
                        <div className="min-w-0">
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                                {oppRoster?.settings?.wins ?? 0}-{oppRoster?.settings?.losses ?? 0} · Opp
                            </div>
                            <div className="font-display text-md md:text-lg font-bold text-text truncate max-w-[280px] md:max-w-[320px]">
                                {displayTeamName(oppUser)}
                            </div>
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

                        <SectionShell title="Win Probability" sub={anyLive ? 'Live · 60s refresh' : 'Updated'}>
                            <WinProbCurve winProb={winProb} />
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

const WinProbCurve = ({ winProb }) => {
    // Tiny stub curve from 0.5 → winProb across 4 quarters.
    const path = `M0,${100 - 0.5 * 100} L80,${100 - (0.5 + (winProb - 0.5) * 0.25) * 100} L160,${100 - (0.5 + (winProb - 0.5) * 0.55) * 100} L240,${100 - (0.5 + (winProb - 0.5) * 0.85) * 100} L320,${100 - winProb * 100}`;
    return (
        <>
            <svg viewBox="0 0 320 110" width="100%" height="110">
                <line x1="0" x2="320" y1="50" y2="50" stroke={theme.color.line} strokeDasharray="2 3" />
                <path d={path} fill="none" stroke={theme.color.signal} strokeWidth="2" />
                <circle cx="320" cy={100 - winProb * 100} r="4" fill={theme.color.signal} />
            </svg>
            <div className="flex justify-between font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
            </div>
        </>
    );
};

export default MatchupDetail;
