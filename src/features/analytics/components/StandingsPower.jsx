import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pip } from '../../../components/ui/Pip';
import { Trend } from '../../../components/ui/Trend';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { usePowerRankings } from '../hooks/usePowerRankings';
import { theme } from '../../../lib/theme';

/* Default Sleeper playoff bracket size when settings don't specify. */
const DEFAULT_PLAYOFF_TEAMS = 6;

const StandingsPower = ({ league, rosters, users, seasonMatchups, currentUserId, week }) => {
    const navigate = useNavigate();
    const [tab, setTab] = useState('standings');

    const playoffSize = league?.settings?.playoff_teams || DEFAULT_PLAYOFF_TEAMS;
    const { rankings, weeksPlayed } = usePowerRankings(seasonMatchups, rosters, users);

    /* Sort by win-record for the "Standings" tab; by composite power
       (currentRank, already sorted) for "Power"; by all-play wins for
       "All-Play". The list payload is the same — only sort changes. */
    const sortedRows = useMemo(() => {
        if (!rankings.length) return [];
        if (tab === 'standings') {
            return [...rankings].sort((a, b) => {
                if (a.wins !== b.wins) return b.wins - a.wins;
                return b.pf - a.pf;
            });
        }
        if (tab === 'allplay') {
            return [...rankings].sort((a, b) => b.allPlayWins - a.allPlayWins);
        }
        return rankings; // power = already by currentRank
    }, [rankings, tab]);

    /* Top-3 podium for mobile. */
    const podium = useMemo(() => {
        if (sortedRows.length < 3) return [];
        return [sortedRows[1], sortedRows[0], sortedRows[2]]; // visual order: 2nd, 1st, 3rd
    }, [sortedRows]);

    /* Movers · this week */
    const movers = useMemo(() => {
        return [...rankings]
            .filter((r) => r.trend.length > 1)
            .sort((a, b) => Math.abs(b.rankChange) - Math.abs(a.rankChange))
            .slice(0, 4);
    }, [rankings]);

    /* Luck index = actual wins - expected wins (from all-play %). */
    const luckRows = useMemo(() => {
        return rankings.map((r) => {
            const totalGames = r.wins + r.losses;
            const apTotal = r.allPlayWins + r.allPlayLosses;
            const expected = apTotal > 0 ? (r.allPlayWins / apTotal) * totalGames : 0;
            return { ...r, luck: r.wins - expected };
        });
    }, [rankings]);

    /* Power Trend chart geometry: top 4 teams across all weeks. */
    const trendChart = useMemo(() => {
        const top4 = rankings.slice(0, 4);
        const w = weeksPlayed.length || 1;
        return top4.map((r) => ({
            ...r,
            // points: each {week, rank}; convert to (x,y) in viewBox
            line: r.trend.map((t, i) => {
                const x = w > 1 ? (i / (w - 1)) * 320 : 0;
                // rank 1 → top (y=10), rank N → bottom (y=130). Cap at numTeams.
                const numTeams = rosters?.length || 12;
                const y = 10 + ((t.rank - 1) / Math.max(1, numTeams - 1)) * 120;
                return [x, y];
            }),
        }));
    }, [rankings, weeksPlayed, rosters?.length]);

    if (!rankings.length) {
        return (
            <section className="space-y-3">
                <div className="bg-bg-1 rounded-xl border border-line p-8 shadow-card text-center">
                    <p className="font-display text-lg font-semibold text-text">Standings unavailable</p>
                    <p className="text-sm text-text-dim mt-1">
                        Need at least one week of completed matchup data.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-5 pb-12">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">
                        Power Rankings · WK <span className="tnum text-text-dim">{week}</span>
                    </div>
                    <h1 className="mt-1 font-display text-2xl md:text-3xl font-extrabold tracking-snug text-text">
                        {league?.name || 'Standings'}
                    </h1>
                </div>
                <SegmentedTabs
                    tabs={[
                        { value: 'standings', label: 'Standings' },
                        { value: 'power', label: 'Power' },
                        { value: 'allplay', label: 'All-Play' },
                        { value: 'luck', label: 'Luck' },
                    ]}
                    value={tab}
                    onChange={setTab}
                    className="max-w-md"
                />
            </header>

            {/* Mobile podium (top 3) */}
            {podium.length === 3 && (
                <div className="lg:hidden grid grid-cols-3 gap-2 items-end">
                    {podium.map((p, i) => {
                        const realRank = [2, 1, 3][i];
                        const isWinner = realRank === 1;
                        return (
                            <button
                                key={p.rosterId}
                                type="button"
                                onClick={() => navigate(`/league/${league.league_id}/team/${p.rosterId}`)}
                                className={`p-3 rounded-xl border text-center transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                                    isWinner
                                        ? 'bg-bg-1 border-signal -translate-y-2'
                                        : 'bg-bg-1 border-line'
                                }`}
                                style={isWinner ? { boxShadow: '0 0 24px rgba(245,179,1,0.18)' } : undefined}
                            >
                                <div
                                    className={`tnum font-display text-xl font-extrabold mb-1 ${
                                        realRank === 1 ? 'text-signal' : realRank === 2 ? 'text-text' : 'text-signal-2'
                                    }`}
                                >
                                    #{realRank}
                                </div>
                                <Pip seed={p.rosterId} name={p.name} size={36} ring={isWinner} className="mx-auto" />
                                <div className="text-xs font-semibold text-text mt-2 truncate">{p.name}</div>
                                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-0.5 tnum">
                                    {p.record}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Two-col body */}
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
                {/* Main table */}
                <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
                    {/* Desktop column headers — match the row template exactly */}
                    <div className="hidden md:grid grid-cols-[40px_36px_1fr_60px_70px_70px_80px_50px] gap-2 font-mono text-2xs uppercase tracking-wider text-text-mute font-bold border-b border-line px-4 py-2.5 bg-bg-2">
                        <span>#</span>
                        <span />
                        <span>Team</span>
                        <span className="text-right">Rec</span>
                        <span className="text-right">PF</span>
                        <span className="text-right">PA</span>
                        <span className="text-right">PWR</span>
                        <span className="text-right">Δ</span>
                    </div>

                    {sortedRows.map((row, i) => {
                        const isMe = row.ownerId && row.ownerId === currentUserId;
                        const rankColor = i < 3 ? 'text-signal' : i < playoffSize ? 'text-text' : 'text-text-mute';
                        const pwr = Math.max(0, Math.min(100, Math.round((row.composite ?? 100 - i * 6) || 0)));
                        return (
                            <div key={row.rosterId}>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/league/${league.league_id}/team/${row.rosterId}`)}
                                    className={`w-full text-left grid items-center gap-2 px-4 py-2.5 hover:bg-bg-2/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal grid-cols-[40px_28px_1fr_50px] md:grid-cols-[40px_36px_1fr_60px_70px_70px_80px_50px] ${
                                        isMe ? 'bg-bg-2/40' : ''
                                    } border-b border-line/60`}
                                >
                                    <span className={`tnum text-sm md:text-md font-extrabold w-8 text-center ${rankColor}`}>
                                        {i + 1}
                                    </span>
                                    {row.avatar ? (
                                        <img src={row.avatar} alt="" className="w-7 h-7 md:w-8 md:h-8 rounded-full ring-1 ring-line shrink-0" />
                                    ) : (
                                        <Pip seed={row.rosterId} name={row.name} size={28} ring={isMe} />
                                    )}
                                    <div className="min-w-0">
                                        <div className={`text-sm truncate ${isMe ? 'text-text font-bold' : 'text-text font-semibold'}`}>
                                            {row.name}
                                        </div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-0.5">
                                            <span className="tnum">PPG {row.ppg.toFixed(1)}</span>
                                            <span className="md:hidden"> · {row.record}</span>
                                        </div>
                                    </div>
                                    <span className="hidden md:block tnum text-xs text-text-dim text-right">{row.record}</span>
                                    <span className="hidden md:block tnum text-xs text-text font-semibold text-right">
                                        {row.pf.toFixed(0)}
                                    </span>
                                    <span className="hidden md:block tnum text-xs text-text-dim text-right">
                                        {row.pa.toFixed(0)}
                                    </span>
                                    <div className="hidden md:block text-right min-w-[70px]">
                                        <div className="tnum text-xs font-bold text-text">{pwr}</div>
                                        <div className="h-1 mt-0.5 rounded-full bg-bg-3 overflow-hidden">
                                            <div
                                                className="h-full"
                                                style={{
                                                    width: `${pwr}%`,
                                                    background:
                                                        i < 3 ? 'var(--good)' : i < playoffSize ? 'var(--signal)' : 'var(--bad)',
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right min-w-[40px]">
                                        <Trend v={row.rankChange} />
                                    </div>
                                </button>
                                {i + 1 === playoffSize && (
                                    <div className="font-mono text-2xs uppercase tracking-wider text-signal font-bold text-center py-1.5 px-4 border-b border-line/60 bg-signal/5">
                                        — Playoff Cut · Top {playoffSize} —
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </section>

                {/* Right rail: trend + movers + luck */}
                <aside className="space-y-4 min-w-0">
                    <SectionShell
                        title="Power Trend"
                        sub={`Top 4 · last ${weeksPlayed.length || 0} wks`}
                    >
                        {weeksPlayed.length < 2 ? (
                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Need at least 2 weeks of data.
                            </p>
                        ) : (
                            <>
                                <svg viewBox="0 0 320 140" width="100%" height="140">
                                    {[10, 40, 70, 100, 130].map((y) => (
                                        <line key={y} x1="0" x2="320" y1={y} y2={y} stroke={theme.color.line} strokeDasharray="2 3" />
                                    ))}
                                    {trendChart.map((t, idx) => (
                                        <polyline
                                            key={t.rosterId}
                                            fill="none"
                                            stroke={[theme.color.signal, theme.color.good, theme.color.signal2, theme.color.textDim][idx]}
                                            strokeWidth="2"
                                            points={t.line.map(([x, y]) => `${x},${y}`).join(' ')}
                                        />
                                    ))}
                                </svg>
                                <div className="flex flex-wrap gap-3 mt-3 font-mono text-2xs uppercase tracking-wider">
                                    {trendChart.map((t, idx) => (
                                        <div key={t.rosterId} className="flex items-center gap-1.5">
                                            <span
                                                className="inline-block w-3 h-0.5"
                                                style={{ background: [theme.color.signal, theme.color.good, theme.color.signal2, theme.color.textDim][idx] }}
                                            />
                                            <span className="text-text-dim truncate max-w-[100px]">{t.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </SectionShell>

                    <SectionShell title={`Movers · Week ${week}`}>
                        {movers.length === 0 ? (
                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Movers appear once teams have multiple weeks of ranking history.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {movers.map((m) => (
                                    <li key={m.rosterId} className="grid grid-cols-[60px_1fr] gap-3 items-start py-1 border-b border-line/60 last:border-0">
                                        <span className={`font-mono text-xs font-bold tnum text-right ${m.rankChange > 0 ? 'text-good' : m.rankChange < 0 ? 'text-bad' : 'text-text-mute'}`}>
                                            {m.rankChange > 0 ? '▲' : m.rankChange < 0 ? '▼' : '—'} {Math.abs(m.rankChange) || 0}
                                        </span>
                                        <div>
                                            <div className="text-xs font-semibold text-text truncate">{m.name}</div>
                                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                                Now <span className="tnum text-text-dim">#{m.currentRank}</span> · prev <span className="tnum">#{m.prevRank}</span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionShell>

                    <SectionShell title="Luck Index">
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2">
                            Actual wins minus expected wins (from all-play %).
                        </p>
                        <ul className="space-y-1.5">
                            {luckRows.map((r) => (
                                <li key={r.rosterId} className="grid grid-cols-[24px_1fr_60px] gap-2 items-center py-1">
                                    <Pip seed={r.rosterId} name={r.name} size={20} />
                                    <span className="text-xs text-text truncate">{r.name}</span>
                                    <span className={`font-mono text-xs text-right tnum font-bold ${r.luck > 0 ? 'text-good' : r.luck < 0 ? 'text-bad' : 'text-text-mute'}`}>
                                        {r.luck > 0 ? '+' : ''}{r.luck.toFixed(1)} luck
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </SectionShell>
                </aside>
            </div>
        </section>
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

export default StandingsPower;
