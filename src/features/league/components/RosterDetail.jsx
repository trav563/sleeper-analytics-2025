import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { displayTeamName, avatarUrl, BYE_MAP_2025 } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { LiveDot } from '../../../components/ui/LiveDot';
import { useGameLiveDetails } from '../../dashboard/hooks/useGameLiveDetails';
import { useAnalyzeTeam } from '../../dashboard/hooks/useAnalyzeTeam';

const POSITION_GROUPS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const ROSTER_HUE = (rosterId) => (Number(rosterId) * 47) % 360;

const RosterDetail = ({ league, rosters, users, players, state, roster, currentWeekMatchups, seasonMatchups }) => {
    const navigate = useNavigate();
    const week = state?.display_week || state?.week || 1;
    const owner = users?.find((u) => u.user_id === roster?.owner_id);
    const hue = ROSTER_HUE(roster?.roster_id);

    const { details: liveDetails } = useGameLiveDetails(week);
    const gameStatuses = useMemo(() => {
        const map = {};
        Object.entries(liveDetails || {}).forEach(([abbr, d]) => {
            map[abbr] = d.statusName;
        });
        return map;
    }, [liveDetails]);

    /* This week's matchup for live points + projection. */
    const myMatchup = useMemo(() => {
        if (!Array.isArray(currentWeekMatchups) || !roster) return null;
        return currentWeekMatchups.find((m) => m.roster_id === roster.roster_id) || null;
    }, [currentWeekMatchups, roster]);

    /* Per-player season totals for SZN avg + projections. */
    const playerSeason = useMemo(() => {
        const out = {};
        if (!seasonMatchups) return out;
        Object.values(seasonMatchups).forEach((ms) => {
            if (!Array.isArray(ms)) return;
            ms.forEach((m) => {
                Object.entries(m.players_points || {}).forEach(([pid, pts]) => {
                    if (!out[pid]) out[pid] = { sum: 0, n: 0, weeks: 0 };
                    out[pid].weeks += 1;
                    if (pts > 0) {
                        out[pid].sum += pts;
                        out[pid].n += 1;
                    }
                });
            });
        });
        return out;
    }, [seasonMatchups]);

    /* Group players: starters / bench / taxi / IR. */
    const grouped = useMemo(() => {
        if (!roster) return { starters: [], bench: [], taxi: [], ir: [] };
        const starters = roster.starters || [];
        const taxi = roster.taxi || [];
        const ir = roster.reserve || [];
        const all = roster.players || [];
        const slotLabels = league?.roster_positions || [];

        const seen = new Set();
        const starterPlayers = starters.map((pid, i) => {
            const slot = slotLabels[i] || '?';
            seen.add(pid);
            const player = pid && pid !== '0' ? players?.[pid] : null;
            return { slot, pid, player };
        });
        const taxiPlayers = taxi.map((pid) => {
            seen.add(pid);
            return { slot: 'TAXI', pid, player: players?.[pid] };
        });
        const irPlayers = ir.map((pid) => {
            seen.add(pid);
            return { slot: 'IR', pid, player: players?.[pid] };
        });
        const benchPlayers = all
            .filter((pid) => !seen.has(pid))
            .map((pid) => ({ slot: players?.[pid]?.position || 'BN', pid, player: players?.[pid] }));

        return {
            starters: starterPlayers,
            bench: benchPlayers,
            taxi: taxiPlayers,
            ir: irPlayers,
        };
    }, [roster, players, league?.roster_positions]);

    /* Positional strength: avg per-game points by position group, normalized
       against the same metric for every other roster in the league. */
    const positionalStrength = useMemo(() => {
        if (!seasonMatchups || !rosters || !players) return [];
        // For every roster, build avg points contributed by each position
        // group across all weeks. Normalize each position 0..100.
        const perRoster = rosters.map((r) => {
            const totals = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
            const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
            Object.values(seasonMatchups).forEach((ms) => {
                if (!Array.isArray(ms)) return;
                const m = ms.find((x) => x.roster_id === r.roster_id);
                if (!m) return;
                (m.starters || []).forEach((pid, i) => {
                    if (!pid || pid === '0') return;
                    const p = players?.[pid];
                    if (!p?.position || !POSITION_GROUPS.includes(p.position)) return;
                    const pts = m.starters_points?.[i] || 0;
                    if (pts > 0) {
                        totals[p.position] += pts;
                        counts[p.position] += 1;
                    }
                });
            });
            const avg = {};
            POSITION_GROUPS.forEach((pos) => {
                avg[pos] = counts[pos] > 0 ? totals[pos] / counts[pos] : 0;
            });
            return { roster_id: r.roster_id, avg };
        });

        // Min/max per position across the league for normalization.
        const range = {};
        POSITION_GROUPS.forEach((pos) => {
            const values = perRoster.map((r) => r.avg[pos]).filter((v) => v > 0);
            range[pos] = {
                min: values.length ? Math.min(...values) : 0,
                max: values.length ? Math.max(...values) : 0,
            };
        });

        const me = perRoster.find((r) => r.roster_id === roster?.roster_id);
        if (!me) return [];
        return POSITION_GROUPS.map((pos) => {
            const v = me.avg[pos];
            const { min, max } = range[pos];
            const norm = max > min ? Math.round(((v - min) / (max - min)) * 100) : (v > 0 ? 80 : 0);
            const label = norm >= 80 ? 'Elite' : norm >= 60 ? 'Strong' : norm >= 40 ? 'Solid' : norm > 0 ? 'Thin' : '—';
            return { pos, pct: norm, label, ppg: v };
        });
    }, [seasonMatchups, rosters, players, roster?.roster_id]);

    /* Upcoming byes for this team (uses BYE_MAP_2025; will be wrong for
       other seasons but it's the only static map we have right now). */
    const upcomingByes = useMemo(() => {
        if (!roster) return [];
        const teamPlayers = (roster.players || [])
            .map((pid) => players?.[pid])
            .filter((p) => p?.team);
        const byWeek = {};
        Object.entries(BYE_MAP_2025).forEach(([wk, teams]) => {
            const wkNum = Number(wk);
            if (wkNum < week) return;
            teams.forEach((teamAbbr) => {
                const matched = teamPlayers.filter((p) => p.team === teamAbbr);
                if (matched.length === 0) return;
                if (!byWeek[wkNum]) byWeek[wkNum] = [];
                byWeek[wkNum].push({ team: teamAbbr, players: matched });
            });
        });
        return Object.entries(byWeek)
            .map(([wk, entries]) => ({
                week: Number(wk),
                entries,
            }))
            .sort((a, b) => a.week - b.week)
            .slice(0, 3);
    }, [roster, players, week]);

    /* AI roster analysis (reuses existing Gemini infrastructure). */
    const { analysis: aiAnalysis, loading: aiLoading, analyze, isOnCooldown, remaining } = useAnalyzeTeam({
        leagueId: league?.league_id,
        userId: roster?.owner_id,
        week,
        analysisType: 'roster',
    });

    /* Hero-strip stats. */
    const wins = roster?.settings?.wins ?? 0;
    const losses = roster?.settings?.losses ?? 0;
    const ties = roster?.settings?.ties ?? 0;
    const pf = ((roster?.settings?.fpts ?? 0) + (roster?.settings?.fpts_decimal ?? 0) / 100).toFixed(1);
    const myRank = useMemo(() => {
        if (!Array.isArray(rosters)) return null;
        const sorted = [...rosters].sort((a, b) => {
            if (a.settings.wins !== b.settings.wins) return b.settings.wins - a.settings.wins;
            const aPf = (a.settings.fpts ?? 0) + (a.settings.fpts_decimal ?? 0) / 100;
            const bPf = (b.settings.fpts ?? 0) + (b.settings.fpts_decimal ?? 0) / 100;
            return bPf - aPf;
        });
        const idx = sorted.findIndex((r) => r.roster_id === roster?.roster_id);
        return idx >= 0 ? idx + 1 : null;
    }, [rosters, roster?.roster_id]);

    if (!roster) {
        return (
            <section className="space-y-3">
                <Back onClick={() => navigate(-1)} />
                <div className="bg-bg-1 rounded-xl border border-line p-8 shadow-card text-center">
                    <p className="font-display text-lg font-semibold text-text">Team not found</p>
                    <p className="text-sm text-text-dim mt-1">No roster matches that ID in this league.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-5 pb-12">
            <Back onClick={() => navigate(-1)} />

            {/* Team hero */}
            <header
                className="rounded-xl border border-line p-5 md:p-6 shadow-card flex flex-col md:flex-row md:items-end md:justify-between gap-5"
                style={{
                    background: `radial-gradient(circle at 0% 0%, oklch(62% 0.18 ${hue} / 0.25), transparent 55%), var(--bg-1)`,
                }}
            >
                <div className="flex items-center gap-4 min-w-0">
                    {owner?.avatar ? (
                        <img src={avatarUrl(owner.avatar)} alt="" className="w-14 h-14 md:w-16 md:h-16 rounded-full ring-2 ring-signal shrink-0" />
                    ) : (
                        <Pip seed={roster.roster_id} name={displayTeamName(owner)} size={56} ring />
                    )}
                    <div className="min-w-0">
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                            @{owner?.username || '—'}
                        </div>
                        <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-snug text-text truncate">
                            {displayTeamName(owner)}
                        </h1>
                        <div className="flex flex-wrap gap-3 mt-2 font-mono text-2xs uppercase tracking-wider text-text-dim">
                            <span><span className="tnum text-text">{wins}-{losses}{ties > 0 ? `-${ties}` : ''}</span> Record</span>
                            {myRank != null && <span><span className="tnum text-signal">#{myRank}</span> Rank</span>}
                            <span><span className="tnum text-text">{pf}</span> PF</span>
                        </div>
                    </div>
                </div>

                {/* Desktop: 5 StatCells right-aligned (record/rank/PF/playoff/streak) */}
                <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 gap-4">
                    <HeroStat label="Record" value={`${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`} />
                    <HeroStat label="Rank" value={myRank != null ? `#${myRank}` : '—'} tone={myRank === 1 ? 'signal' : 'text'} />
                    <HeroStat label="PF" value={pf} />
                    <HeroStat label="Playoff" value="—" />
                    <HeroStat label="Streak" value="—" />
                </div>
            </header>

            {/* Two-col body */}
            <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
                {/* Roster table */}
                <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
                    <header className="flex items-center justify-between px-4 py-3 border-b border-line">
                        <h3 className="font-display text-md font-semibold text-text">
                            Roster · Week <span className="tnum">{week}</span>
                        </h3>
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                            <span className="tnum">{(roster.players || []).length}</span> rostered
                        </span>
                    </header>

                    <RosterTable
                        title="Starters"
                        rows={grouped.starters}
                        playerSeason={playerSeason}
                        myMatchup={myMatchup}
                        gameStatuses={gameStatuses}
                        navigate={navigate}
                        leagueId={league?.league_id}
                        showLive
                    />

                    {grouped.bench.length > 0 && (
                        <RosterTable
                            title="Bench"
                            rows={grouped.bench}
                            playerSeason={playerSeason}
                            myMatchup={myMatchup}
                            gameStatuses={gameStatuses}
                            navigate={navigate}
                            leagueId={league?.league_id}
                        />
                    )}

                    {grouped.taxi.length > 0 && (
                        <RosterTable
                            title="Taxi"
                            rows={grouped.taxi}
                            playerSeason={playerSeason}
                            navigate={navigate}
                            leagueId={league?.league_id}
                        />
                    )}

                    {grouped.ir.length > 0 && (
                        <RosterTable
                            title="IR"
                            rows={grouped.ir}
                            playerSeason={playerSeason}
                            navigate={navigate}
                            leagueId={league?.league_id}
                        />
                    )}
                </section>

                {/* Right rail */}
                <aside className="space-y-4 min-w-0">
                    <SectionShell title="Positional Strength">
                        {positionalStrength.length === 0 ? (
                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Need at least one week of scoring to compute.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {positionalStrength.map((p) => (
                                    <li key={p.pos} className="grid grid-cols-[36px_1fr_auto] gap-3 items-center">
                                        <span className="font-mono text-xs uppercase tracking-wider text-text-dim font-bold">{p.pos}</span>
                                        <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
                                            <div
                                                className="h-full"
                                                style={{
                                                    width: `${p.pct}%`,
                                                    background: p.pct >= 80
                                                        ? 'var(--good)'
                                                        : p.pct >= 60
                                                            ? 'var(--signal)'
                                                            : p.pct > 0 ? 'var(--bad)' : 'transparent',
                                                }}
                                            />
                                        </div>
                                        <span className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                                            <span className="tnum text-text font-bold">{p.pct}</span> · {p.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionShell>

                    <SectionShell
                        title="AI Roster Analysis"
                        eyebrow="AI"
                        action={
                            !aiLoading && !isOnCooldown ? (
                                <button
                                    type="button"
                                    onClick={() => analyze({ force: false })}
                                    className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wider font-bold text-signal hover:text-signal/80 transition-colors duration-fast"
                                >
                                    <Sparkles className="w-3 h-3" /> Generate
                                </button>
                            ) : null
                        }
                    >
                        {aiLoading ? (
                            <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-text-mute">
                                <LiveDot label="Generating" />
                                Analyzing roster…
                            </div>
                        ) : aiAnalysis ? (
                            <div className="text-sm text-text-dim leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {aiAnalysis.split('\n').slice(0, 12).join('\n')}
                                {aiAnalysis.split('\n').length > 12 && (
                                    <span className="block mt-2 font-mono text-2xs text-text-mute uppercase tracking-wider">
                                        … truncated · view full on Dashboard
                                    </span>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-text-dim leading-relaxed">
                                Tap <span className="font-mono text-2xs uppercase tracking-wider text-signal">Generate</span> to get an
                                AI-written roster breakdown — surplus positions, needs, and lineup recommendations.
                                {remaining != null && remaining < 999 && (
                                    <span className="block mt-1 font-mono text-2xs uppercase tracking-wider text-text-mute">
                                        <span className="tnum">{remaining}</span> left today
                                    </span>
                                )}
                            </p>
                        )}
                    </SectionShell>

                    <SectionShell title="Upcoming Byes">
                        {upcomingByes.length === 0 ? (
                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                No upcoming byes affect this roster.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {upcomingByes.map((b) => (
                                    <li key={b.week} className="grid grid-cols-[44px_1fr] gap-3 items-start py-1 border-b border-line/60 last:border-0">
                                        <span className={`font-mono text-2xs uppercase tracking-wider tnum font-bold ${b.week - week <= 1 ? 'text-bad' : 'text-text-dim'}`}>
                                            Wk {b.week}
                                        </span>
                                        <div className="text-xs text-text-dim">
                                            {b.entries.flatMap((e) => e.players.map((p) => p.last_name)).join(', ')}
                                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-0.5">
                                                {b.entries.map((e) => e.team).join(' · ')}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionShell>
                </aside>
            </div>
        </section>
    );
};

/* ---------- helpers ---------- */
const Back = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-text-dim hover:text-signal text-xs font-mono uppercase tracking-wider transition-colors duration-fast"
    >
        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
    </button>
);

const HeroStat = ({ label, value, tone = 'text' }) => {
    const toneClass = tone === 'signal' ? 'text-signal' : 'text-text';
    return (
        <div className="text-center">
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">{label}</div>
            <div className={`font-display tnum text-xl md:text-2xl font-extrabold tracking-tight mt-0.5 ${toneClass}`}>
                {value}
            </div>
        </div>
    );
};

const SectionShell = ({ title, eyebrow, action, children }) => (
    <section className="bg-bg-1 rounded-xl border border-line p-4 shadow-card">
        <header className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
                {eyebrow && (
                    <span
                        className="font-mono text-2xs font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-ink shrink-0"
                        style={{ background: 'linear-gradient(90deg, var(--signal), var(--signal-2))' }}
                    >
                        {eyebrow}
                    </span>
                )}
                <h3 className="font-display text-md font-semibold text-text truncate">{title}</h3>
            </div>
            {action}
        </header>
        {children}
    </section>
);

const RosterTable = ({ title, rows, playerSeason, myMatchup, gameStatuses, navigate, leagueId, showLive = false }) => (
    <div>
        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold px-4 pt-3 pb-1.5 bg-bg-2/40">
            {title}
        </div>
        {rows.map((row, i) => {
            const player = row.player;
            const livePts = showLive && player ? (myMatchup?.players_points?.[row.pid] ?? 0) : null;
            const seasonInfo = player ? playerSeason[row.pid] : null;
            const seasonAvg = seasonInfo && seasonInfo.n > 0 ? seasonInfo.sum / seasonInfo.n : null;
            const proj = seasonAvg != null ? seasonAvg : null;
            const status = player?.team ? gameStatuses?.[player.team] : null;
            const isLive = status === 'STATUS_IN_PROGRESS' || status === 'STATUS_HALFTIME';

            if (!row.pid || row.pid === '0') {
                return (
                    <div
                        key={i}
                        className="grid grid-cols-[40px_1fr_auto] md:grid-cols-[46px_28px_1fr_60px_60px_60px_44px] gap-2 items-center px-4 py-2.5 border-b border-line/60 last:border-0"
                    >
                        <span className="font-mono text-2xs font-bold uppercase tracking-wider text-text-mute bg-bg-2 px-2 py-0.5 rounded-sm text-center">
                            {row.slot}
                        </span>
                        <span className="text-sm text-text-mute italic md:col-span-6">Empty slot</span>
                    </div>
                );
            }
            if (!player) return null;

            return (
                <button
                    key={i}
                    type="button"
                    onClick={() => navigate(`/league/${leagueId}/player/${row.pid}`)}
                    className={`w-full grid grid-cols-[40px_1fr_auto] md:grid-cols-[46px_28px_1fr_60px_60px_60px_44px] gap-2 md:gap-3 items-center px-4 py-2.5 text-left border-b border-line/60 last:border-0 hover:bg-bg-2/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                        isLive ? 'bg-gradient-to-r from-signal-2/8 to-transparent' : ''
                    }`}
                >
                    <span className={`font-mono text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm text-center ${
                        isLive ? 'text-signal bg-signal/15' : 'text-text-dim bg-bg-2'
                    }`}>
                        {row.slot}
                    </span>
                    <span
                        className="hidden md:block w-7 h-7 rounded-full ring-1 ring-line shrink-0"
                        style={{ background: `oklch(62% 0.18 ${(player.team?.charCodeAt(0) || 0) * 13 % 360})` }}
                    />
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-text truncate">
                            {player.first_name?.[0]}. {player.last_name}
                        </div>
                        <div className={`font-mono text-2xs uppercase tracking-wider mt-0.5 ${isLive ? 'text-signal-2' : 'text-text-mute'}`}>
                            {isLive && '● '}{player.team || 'FA'} · {player.position}{player.age ? ` · ${player.age}yo` : ''}
                            {player.injury_status && <span className="text-bad ml-1.5">{player.injury_status}</span>}
                        </div>
                    </div>
                    {showLive && (
                        <div className={`tnum text-sm font-bold text-right ${(livePts || 0) > 0 ? 'text-text' : 'text-text-mute'} md:hidden`}>
                            {livePts != null ? livePts.toFixed(1) : '—'}
                        </div>
                    )}
                    <div className={`hidden md:block tnum text-sm font-bold text-right ${(livePts || 0) > 0 ? 'text-text' : 'text-text-mute'}`}>
                        {showLive ? (livePts != null ? livePts.toFixed(1) : '—') : '—'}
                    </div>
                    <div className="hidden md:block tnum text-xs text-text-dim text-right">
                        {proj != null ? proj.toFixed(1) : '—'}
                    </div>
                    <div className="hidden md:block tnum text-xs text-text-dim text-right">
                        {seasonAvg != null ? seasonAvg.toFixed(1) : '—'}
                    </div>
                    <div className="hidden md:block font-mono text-2xs uppercase tracking-wider text-text-mute text-right">
                        {byeWeekFor(player.team) ? `W${byeWeekFor(player.team)}` : '—'}
                    </div>
                </button>
            );
        })}
    </div>
);

/* Reverse-lookup helper for BYE_MAP_2025: given a team abbr, what week is the bye? */
const byeWeekFor = (team) => {
    if (!team) return null;
    for (const [wk, teams] of Object.entries(BYE_MAP_2025)) {
        if (teams.includes(team)) return Number(wk);
    }
    return null;
};

export default RosterDetail;
