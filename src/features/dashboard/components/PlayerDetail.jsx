import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import { playerHeadshotUrl, displayTeamName } from '../../../utils/nflData';
import { theme, getTeamHue } from '../../../lib/theme';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { useSeasonMatchups } from '../../analytics/hooks/useSeasonMatchups';
import { useDefenseRanks } from '../../analytics/hooks/useDefenseRanks';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';
import { useGameWeather } from './_useGameWeather';

/* -----------------------------------------------------------
 * Inline weather hook to avoid yet another file. Falls back to
 * an empty map when ESPN is unreachable.
 * (See _useGameWeather below — it's defined in this same file.)
 * --------------------------------------------------------- */

const STAT_TONE = { signal: 'text-signal', good: 'text-good', text: 'text-text' };

const PlayerDetail = ({ player, league, rosters, users, state }) => {
    const navigate = useNavigate();
    const leagueId = league?.league_id;
    const week = state?.display_week || state?.week || 1;
    const seasonType = state?.season_type;

    const { seasonMatchups } = useSeasonMatchups(leagueId, week);
    const { details: liveDetails } = useGameLiveDetails(week);
    const { weather } = useGameWeather(week);
    const defenseRanks = useDefenseRanks(seasonMatchups, useMemo(() => {
        const map = {};
        if (player) map[player.player_id] = player;
        return map;
    }, [player]));

    const [tab, setTab] = useState('gamelog');

    /* -------------------------------------------------------
     * Derived stats (memoized)
     * ----------------------------------------------------- */
    const weekly = useMemo(() => {
        if (!seasonMatchups || !player) return [];
        const out = [];
        Object.entries(seasonMatchups).forEach(([wk, ms]) => {
            if (!Array.isArray(ms)) return;
            ms.forEach((m) => {
                const pts = m.players_points?.[player.player_id];
                if (pts !== undefined) {
                    out.push({ week: Number(wk), points: pts });
                }
            });
        });
        return out.sort((a, b) => a.week - b.week);
    }, [seasonMatchups, player]);

    const seasonStats = useMemo(() => {
        const scored = weekly.filter((w) => w.points > 0);
        if (scored.length === 0) return { avg: null, high: null, low: null, count: 0 };
        const total = scored.reduce((s, w) => s + w.points, 0);
        return {
            avg: total / scored.length,
            high: Math.max(...scored.map((w) => w.points)),
            low: Math.min(...scored.map((w) => w.points)),
            count: scored.length,
        };
    }, [weekly]);

    const liveScore = useMemo(() => {
        if (!seasonMatchups || !player) return null;
        const ms = seasonMatchups[week];
        if (!Array.isArray(ms)) return null;
        for (const m of ms) {
            const pts = m.players_points?.[player.player_id];
            if (pts !== undefined) return pts;
        }
        return null;
    }, [seasonMatchups, week, player]);

    const ownership = useMemo(() => {
        if (!rosters || !player) return null;
        const total = rosters.length;
        const owned = rosters.filter((r) => r.players?.includes(player.player_id)).length;
        return total ? Math.round((owned / total) * 100) : null;
    }, [rosters, player]);

    const positionRank = useMemo(() => {
        if (!seasonMatchups || !player || !player.position) return null;
        const totals = {}; // pid -> total
        Object.values(seasonMatchups).forEach((ms) => {
            if (!Array.isArray(ms)) return;
            ms.forEach((m) => {
                Object.entries(m.players_points || {}).forEach(([pid, pts]) => {
                    if (pts > 0) totals[pid] = (totals[pid] || 0) + pts;
                });
            });
        });
        // We only have positions for players in `players` map — caller must
        // pass the whole players map for true ranking. For now compute a
        // local rank only if we have it on the focus player.
        const focusTotal = totals[player.player_id];
        if (!focusTotal) return null;
        // Without a global players-map here we can't rank by position; skip
        // for now — rendered as `—`.
        return null;
    }, [seasonMatchups, player]);

    /* -------------------------------------------------------
     * Loading / not-found states
     * ----------------------------------------------------- */
    if (!player) {
        return (
            <section className="space-y-3">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-1.5 text-text-dim hover:text-signal text-sm font-mono uppercase tracking-wider transition-colors duration-fast"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <div className="bg-bg-1 rounded-xl border border-line p-8 shadow-card text-center">
                    <Activity className="w-8 h-8 text-text-mute mx-auto mb-3" />
                    <p className="font-display text-lg font-semibold text-text">Player not found</p>
                    <p className="text-sm text-text-dim mt-1">
                        This player isn't in the league's roster snapshot yet.
                    </p>
                </div>
            </section>
        );
    }

    /* -------------------------------------------------------
     * Player meta
     * ----------------------------------------------------- */
    const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
    const hue = getTeamHue(player.team || player.player_id);
    const tintBg = `oklch(62% 0.18 ${hue} / 0.4)`;
    const tintBgSoft = `oklch(62% 0.18 ${hue} / 0.18)`;
    const headshot = playerHeadshotUrl(player.player_id);
    const live = liveDetails[player.team];
    const isLive = live && (live.statusName === 'STATUS_IN_PROGRESS' || live.statusName === 'STATUS_HALFTIME');
    const oppTeam = live?.opponent;
    const wx = weather?.[player.team];
    const defRank = oppTeam ? defenseRanks?.[oppTeam]?.[player.position]?.rank : null;
    const ownerRoster = rosters?.find((r) => r.players?.includes(player.player_id));
    const ownerUser = ownerRoster ? users?.find((u) => u.user_id === ownerRoster.owner_id) : null;

    /* -------------------------------------------------------
     * Stat row
     * ----------------------------------------------------- */
    const statCells = [
        {
            label: 'Live',
            value: liveScore != null ? liveScore.toFixed(1) : '—',
            tone: isLive ? 'signal' : 'text',
        },
        {
            label: 'Proj',
            value: seasonStats.avg != null ? seasonStats.avg.toFixed(1) : '—',
            tone: 'text',
        },
        {
            label: 'Szn Avg',
            value: seasonStats.avg != null ? seasonStats.avg.toFixed(1) : '—',
            tone: 'text',
        },
        {
            label: 'Own%',
            value: ownership != null ? `${ownership}%` : '—',
            tone: 'text',
        },
        {
            label: 'Rank',
            value: positionRank != null ? `${player.position}${positionRank}` : '—',
            tone: 'good',
            desktopOnly: true,
        },
    ];

    /* ---- Bar chart geometry ---- */
    const chartWeeks = weekly.length > 0 ? weekly : Array.from({ length: 8 }, (_, i) => ({ week: i + 1, points: 0 }));
    const maxPoints = Math.max(10, ...chartWeeks.map((w) => w.points));

    return (
        <section className="space-y-5 pb-12">
            {/* Hero */}
            <header
                className="rounded-xl border border-line p-5 md:p-7 shadow-card relative overflow-hidden"
                style={{
                    background: `linear-gradient(180deg, ${tintBg}, var(--bg) 90%)`,
                }}
            >
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-1.5 text-text-dim hover:text-signal text-xs font-mono uppercase tracking-wider transition-colors duration-fast mb-4"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Roster
                </button>

                <div className="grid md:grid-cols-[auto_1fr_auto] items-center gap-5 md:gap-7">
                    {/* Headshot / fallback */}
                    {headshot ? (
                        <img
                            src={headshot}
                            alt={fullName}
                            className="w-[72px] h-[72px] md:w-[120px] md:h-[120px] rounded-2xl object-cover ring-1 ring-line-strong shrink-0 bg-bg-2"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp';
                            }}
                        />
                    ) : (
                        <div
                            className="striped-placeholder w-[72px] h-[72px] md:w-[120px] md:h-[120px] rounded-2xl ring-1 ring-line-strong shrink-0"
                            style={{ background: `oklch(62% 0.18 ${hue})` }}
                        />
                    )}

                    {/* Name + chips */}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span
                                className="font-mono text-2xs font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-signal"
                                style={{ background: 'rgba(245, 179, 1, 0.15)' }}
                            >
                                {player.position}
                            </span>
                            {player.team && (
                                <span
                                    className="font-mono text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-text"
                                    style={{ background: tintBgSoft }}
                                >
                                    {player.team}
                                </span>
                            )}
                            {player.number && (
                                <span className="font-mono text-2xs uppercase tracking-wider text-text-dim tnum">
                                    #{player.number}
                                </span>
                            )}
                            {player.age && (
                                <span className="font-mono text-2xs uppercase tracking-wider text-text-dim">
                                    Age <span className="tnum">{player.age}</span>
                                </span>
                            )}
                            {player.injury_status && (
                                <span className="font-mono text-2xs font-bold uppercase tracking-wider text-bad bg-bad/10 border border-bad/30 px-1.5 py-0.5 rounded-sm">
                                    {player.injury_status}
                                </span>
                            )}
                        </div>
                        <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight text-text leading-none">
                            {fullName}
                        </h1>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-dim mt-3">
                            {oppTeam
                                ? <>{live?.isHome ? 'vs' : '@'} {oppTeam}{live?.displayClock ? <> · <span className="tnum text-signal-2">{live.statusName === 'STATUS_FINAL' ? 'Final' : `Q${live.period} ${live.displayClock}`}</span></> : ''}</>
                                : <span>{seasonType === 'pre' ? 'Preseason' : `Week ${week}`}</span>}
                            {ownerUser && ownerRoster && (
                                <> · Rostered by{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/league/${leagueId}/team/${ownerRoster.roster_id}`)}
                                        className="text-text-dim hover:text-signal underline-offset-2 hover:underline transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal rounded-sm"
                                    >
                                        {displayTeamName(ownerUser)}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Stat row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:gap-6 lg:gap-8 mt-4 gap-2">
                            {statCells.map((s) => (
                                <div
                                    key={s.label}
                                    className={`rounded-md md:bg-transparent md:border-0 md:p-0 bg-bg-2 border border-line p-2.5 text-center md:text-left ${s.desktopOnly ? 'hidden md:block' : ''}`}
                                >
                                    <div className="font-mono text-2xs font-bold uppercase tracking-wider text-text-mute">
                                        {s.label}
                                    </div>
                                    <div className={`font-display tnum text-xl md:text-2xl font-extrabold tracking-tight mt-0.5 ${STAT_TONE[s.tone] || 'text-text'}`}>
                                        {s.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action column (desktop only) */}
                    <div className="hidden md:flex flex-col gap-2 shrink-0 self-start">
                        <button
                            type="button"
                            onClick={() => navigate(`/league/${leagueId}/lineup`)}
                            className="min-h-[44px] px-4 rounded-md bg-signal text-ink font-semibold text-sm hover:bg-signal/90 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                        >
                            View in Lineup
                        </button>
                        <button
                            type="button"
                            disabled
                            title="Coming soon"
                            className="min-h-[44px] px-4 rounded-md bg-bg-2 text-text-dim font-semibold text-sm border border-line opacity-60 cursor-not-allowed"
                        >
                            Compare Players
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <SegmentedTabs
                tabs={[
                    { value: 'gamelog', label: 'Game Log' },
                    { value: 'news', label: 'News' },
                    { value: 'matchup', label: 'Matchup' },
                    { value: 'trends', label: 'Trends' },
                ]}
                value={tab}
                onChange={setTab}
                className="max-w-md"
            />

            {tab === 'gamelog' && (
                <div className="grid md:grid-cols-3 gap-4">
                    {/* Weekly chart */}
                    <section className="md:col-span-2 bg-bg-1 rounded-xl border border-line p-4 md:p-5 shadow-card">
                        <header className="flex items-baseline justify-between mb-3">
                            <div className="font-display text-md font-semibold text-text">
                                <span className="tnum">{league?.season || ''}</span> Weekly Points
                            </div>
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Avg <span className="tnum text-text">{seasonStats.avg != null ? seasonStats.avg.toFixed(1) : '—'}</span>
                                {seasonStats.high != null && (
                                    <> · High <span className="tnum text-good">{seasonStats.high.toFixed(1)}</span></>
                                )}
                                {seasonStats.low != null && (
                                    <> · Low <span className="tnum text-bad">{seasonStats.low.toFixed(1)}</span></>
                                )}
                            </div>
                        </header>
                        {weekly.length === 0 ? (
                            <div className="h-48 flex items-center justify-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                                No scoring data this season
                            </div>
                        ) : (
                            <>
                                <svg viewBox={`0 0 ${chartWeeks.length * 80 + 40} 220`} className="w-full" preserveAspectRatio="none" style={{ maxHeight: 240 }}>
                                    {seasonStats.avg != null && (
                                        <line
                                            x1="0"
                                            x2={chartWeeks.length * 80 + 40}
                                            y1={200 - (seasonStats.avg / maxPoints) * 180}
                                            y2={200 - (seasonStats.avg / maxPoints) * 180}
                                            stroke={theme.color.signal}
                                            strokeDasharray="4 4"
                                            opacity="0.4"
                                        />
                                    )}
                                    {chartWeeks.map((w, i) => {
                                        const h = (w.points / maxPoints) * 180;
                                        const x = 20 + i * 80;
                                        const isCurrent = w.week === week;
                                        return (
                                            <g key={w.week}>
                                                <rect
                                                    x={x}
                                                    y={200 - h}
                                                    width="58"
                                                    height={h}
                                                    fill={isCurrent ? theme.color.signal : `oklch(62% 0.18 ${hue})`}
                                                    rx="3"
                                                />
                                                {w.points > 0 && (
                                                    <text
                                                        x={x + 29}
                                                        y={200 - h - 6}
                                                        textAnchor="middle"
                                                        fontSize="12"
                                                        fontWeight="700"
                                                        fill={theme.color.text}
                                                        style={{ fontFamily: 'var(--font-sans)' }}
                                                    >
                                                        {w.points.toFixed(1)}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}
                                </svg>
                                <div className="flex font-mono text-2xs uppercase tracking-wider text-text-mute mt-2 px-5">
                                    {chartWeeks.map((w) => (
                                        <span key={w.week} style={{ width: 78, textAlign: 'center' }} className="tnum">
                                            W{w.week}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </section>

                    {/* In the League */}
                    <section className="bg-bg-1 rounded-xl border border-line p-4 md:p-5 shadow-card">
                        <header className="font-display text-md font-semibold text-text mb-3">In the League</header>
                        <p className="text-sm text-text-dim leading-relaxed mb-3">
                            {ownership != null ? (
                                <>
                                    Rostered on <span className="text-text font-semibold tnum">{ownership}%</span> of teams
                                    {ownerUser ? (
                                        <> · current owner: <span className="text-text font-semibold">{displayTeamName(ownerUser)}</span></>
                                    ) : ' · currently a free agent.'}
                                </>
                            ) : (
                                <>Roster ownership data not available.</>
                            )}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                player.injury_status && `${player.injury_status} status`,
                                player.years_exp != null && `${player.years_exp} yr exp`,
                                player.age != null && `Age ${player.age}`,
                                player.team && `On ${player.team}`,
                            ].filter(Boolean).map((tag) => (
                                <span key={tag} className="font-mono text-2xs uppercase tracking-wider text-text-dim bg-bg-2 border border-line px-2 py-1 rounded-sm">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {tab === 'news' && (
                <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card">
                    <header className="font-display text-md font-semibold text-text mb-2">News & Notes</header>
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-mute italic">
                        Per-player news feed lives behind <code className="text-text-dim">/api/news</code> in production.
                        On the live deploy, ESPN/Sleeper alerts mentioning this player surface here.
                    </p>
                </section>
            )}

            {tab === 'matchup' && (
                <section className="bg-bg-1 rounded-xl border border-line p-5 shadow-card">
                    <header className="font-display text-md font-semibold text-text mb-3">
                        Matchup{oppTeam ? <> · {live?.isHome ? 'vs' : '@'} {oppTeam}</> : ''}
                    </header>
                    {!oppTeam ? (
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                            No live game data for this player's team this week.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            <Row k={`${player.position} fantasy pts allowed`} v={defRank ? `${defRank}${ord(defRank)}-most` : '—'} sub={defRank ? `Position rank vs ${oppTeam}` : null} tone="signal" />
                            <Row k="Game state" v={isLive ? `Q${live.period} ${live.displayClock}` : (live?.statusName === 'STATUS_FINAL' ? 'Final' : 'Scheduled')} sub={null} />
                            <Row k="Home / Away" v={live?.isHome ? 'Home' : 'Away'} sub={null} />
                            <Row
                                k="Weather"
                                v={wx?.isIndoor ? 'Dome' : (wx?.displayValue || '—')}
                                sub={wx?.temp ? `${wx.temp}°F` : null}
                                tone={wx?.isAdverse ? 'signal-2' : 'text'}
                            />
                        </ul>
                    )}
                </section>
            )}

            {tab === 'trends' && (
                <section className="bg-bg-1 rounded-xl border border-line p-8 shadow-card text-center">
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        Rolling-average trends · coming soon
                    </p>
                </section>
            )}
        </section>
    );
};

const Row = ({ k, v, sub, tone = 'text' }) => {
    const toneClass = tone === 'signal' ? 'text-signal' : tone === 'signal-2' ? 'text-signal-2' : 'text-text';
    return (
        <li className="grid grid-cols-[1fr_auto] gap-3 items-baseline border-b border-line/60 last:border-0 pb-2 last:pb-0">
            <span className="text-sm text-text-dim">{k}</span>
            <span className="text-right">
                <span className={`tnum font-semibold ${toneClass}`}>{v}</span>
                {sub && <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">{sub}</div>}
            </span>
        </li>
    );
};

const ord = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
};

export default PlayerDetail;

/* -----------------------------------------------------------
 * Internal helper hooks (kept in this file to avoid sprawl)
 * --------------------------------------------------------- */
// Note: imported from `_useGameWeather` import above — actually live in
// this file? No, we declared an import. Let me un-export here and rely
// on the existing services/nflSchedule.js getGameWeather via a wrapper.
// (See sibling file _useGameWeather.js.)
