import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { displayTeamName } from '../../../utils/nflData';
import { Swords } from 'lucide-react';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { useRivalries } from '../hooks/useRivalries';
import { pairKey, sortRivalries } from '../../../utils/rivalries';

const SCOPE_TABS = [
    { value: 'reg', label: 'Regular Season' },
    { value: 'all', label: 'All-Time' },
];

const SORT_TABS = [
    { value: 'closest', label: 'Closest' },
    { value: 'meetings', label: 'Meetings' },
    { value: 'lopsided', label: 'Lopsided' },
];

const Frame = ({ children }) => (
    <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">{children}</section>
);

const MessageBox = ({ children }) => (
    <Frame>
        <div className="p-8 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">{children}</div>
    </Frame>
);

const RivalryMatrix = ({ currentUserId, users, selectedUser1Id, selectedUser2Id, leagueId }) => {
    const { leagueHistory, loadHistory, user } = useSleeper();
    const [viewMode, setViewMode] = useState('h2h');
    const [scope, setScope] = useState('reg');
    const [sortKey, setSortKey] = useState('closest');
    const [user1Id, setUser1Id] = useState(currentUserId);
    const [user2Id, setUser2Id] = useState('');

    // Current-league managers only — the board is about people you can still
    // play, so managers who have left the league are left out.
    const currentOwnerIds = useMemo(() => {
        const currentSeason = leagueHistory?.[0]?.rosters;
        const ids = currentSeason
            ? Object.keys(currentSeason)
            : (users || []).map((u) => u.user_id);
        return ids.filter(Boolean);
    }, [leagueHistory, users]);

    const { rivalries, byPair, loading, error } = useRivalries(leagueHistory, currentOwnerIds);

    const nameById = useMemo(() => {
        const map = new Map();
        (users || []).forEach((u) => map.set(u.user_id, displayTeamName(u)));
        return map;
    }, [users]);
    const nameOf = (id) => nameById.get(id) || `User ${id}`;

    // Track the parent's pickers so the selected pair follows them. Adjusting
    // state during render is React's supported pattern for "reset state when a
    // prop changes"; an effect here would cost an extra cascading render.
    const [syncedFrom, setSyncedFrom] = useState({ a: null, b: null, me: null });
    if (
        syncedFrom.a !== selectedUser1Id ||
        syncedFrom.b !== selectedUser2Id ||
        syncedFrom.me !== currentUserId
    ) {
        setSyncedFrom({ a: selectedUser1Id, b: selectedUser2Id, me: currentUserId });
        if (selectedUser1Id) setUser1Id(selectedUser1Id);
        else if (currentUserId && !user1Id) setUser1Id(currentUserId);
        if (selectedUser2Id) {
            setUser2Id(selectedUser2Id);
            setViewMode('h2h');
        }
    }

    useEffect(() => {
        if (!leagueHistory && leagueId) {
            loadHistory(leagueId, user?.user_id);
        }
    }, [leagueHistory, leagueId, user, loadHistory]);

    const board = useMemo(
        () => sortRivalries(rivalries, sortKey, scope),
        [rivalries, sortKey, scope]
    );

    // Head-to-head detail is a lookup into the same aggregate the board uses, so
    // the two tabs can never disagree about the same pair.
    const h2h = useMemo(() => {
        if (!user1Id || !user2Id) return null;
        const entry = byPair.get(pairKey(user1Id, user2Id));
        if (!entry) return null;

        const record = entry[scope];
        const flip = entry.aId !== user1Id;
        const history = entry.games
            .filter((g) => scope === 'all' || !g.isPlayoff)
            .map((g) => {
                const score1 = flip ? g.pointsB : g.pointsA;
                const score2 = flip ? g.pointsA : g.pointsB;
                let winner = null;
                if (score1 > score2) winner = user1Id;
                else if (score2 > score1) winner = user2Id;
                return { season: g.season, week: g.week, isPlayoff: g.isPlayoff, score1, score2, winner };
            });

        return {
            wins1: flip ? record.l : record.w,
            wins2: flip ? record.w : record.l,
            ties: record.t,
            points1: flip ? record.pointsB : record.pointsA,
            points2: flip ? record.pointsA : record.pointsB,
            games: record.g,
            playoffGames: record.playoffGames,
            history,
        };
    }, [user1Id, user2Id, byPair, scope]);

    const openPair = (aId, bId) => {
        setUser1Id(aId);
        setUser2Id(bId);
        setViewMode('h2h');
    };

    if (error) return <MessageBox>Could not load rivalry history</MessageBox>;
    if (loading) return <MessageBox>Loading rivalry history…</MessageBox>;
    if (!leagueHistory) return <MessageBox>Loading league history…</MessageBox>;
    if (leagueHistory.length === 0) return <MessageBox>No league history found</MessageBox>;

    const user1 = users?.find((u) => u.user_id === user1Id);
    const user2 = users?.find((u) => u.user_id === user2Id);

    const scopeNote = scope === 'reg' ? 'Regular season' : 'Regular season + playoffs';

    return (
        <Frame>
            <header className="p-4 border-b border-line flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                            <Swords className="w-3 h-3 text-signal-2" aria-hidden="true" />
                            Rivalry Analysis
                        </div>
                        <h3 className="mt-1 font-display text-lg font-semibold text-text">
                            Head-to-Head History
                        </h3>
                    </div>
                    <SegmentedTabs
                        tabs={[
                            { value: 'h2h', label: 'Head-to-Head' },
                            { value: 'matrix', label: 'All Rivalries' },
                        ]}
                        value={viewMode}
                        onChange={setViewMode}
                    />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <SegmentedTabs
                        tabs={SCOPE_TABS}
                        value={scope}
                        onChange={setScope}
                        className="sm:w-72"
                    />
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        {scopeNote} · consolation excluded
                    </span>
                </div>
            </header>

            <div className="p-5">
                {viewMode === 'h2h' ? (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row items-stretch md:items-end justify-center gap-4 md:gap-6">
                            <div className="w-full md:w-64">
                                <label className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1">Team A</label>
                                <select
                                    className="w-full bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                                    value={user1Id || ''}
                                    onChange={(e) => setUser1Id(e.target.value)}
                                >
                                    <option value="" disabled>Select Team A</option>
                                    {users?.map(u => (
                                        <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="font-display font-bold text-2xl text-text-mute self-center md:self-end md:pb-2">VS</div>

                            <div className="w-full md:w-64">
                                <label className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1">Team B</label>
                                <select
                                    className="w-full bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                                    value={user2Id || ''}
                                    onChange={(e) => setUser2Id(e.target.value)}
                                >
                                    <option value="" disabled>Select Team B</option>
                                    {users?.filter(u => u.user_id !== user1Id).map(u => (
                                        <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {h2h && h2h.games > 0 ? (
                            <div className="animate-fade-in">
                                <div className="grid grid-cols-3 gap-3 bg-bg-2 rounded-xl p-5 border border-line">
                                    <div className="text-center">
                                        <div className="tnum font-display text-3xl font-bold text-signal">{h2h.wins1}</div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">Wins</div>
                                        <div className="text-sm font-semibold text-text mt-2 truncate px-1">{displayTeamName(user1)}</div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center border-x border-line">
                                        <div className="tnum font-display text-3xl font-bold text-text">{h2h.games}</div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                                            {h2h.ties > 0 ? `Games · ${h2h.ties} tied` : 'Total Games'}
                                        </div>
                                        {scope === 'all' && h2h.playoffGames > 0 && (
                                            <div className="font-mono text-2xs uppercase tracking-wider text-signal-2 mt-1 tnum">
                                                {h2h.playoffGames} playoff
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-center">
                                        <div className="tnum font-display text-3xl font-bold text-signal-2">{h2h.wins2}</div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">Wins</div>
                                        <div className="text-sm font-semibold text-text mt-2 truncate px-1">{displayTeamName(user2)}</div>
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { label: 'Total Points', a: h2h.points1, b: h2h.points2 },
                                        { label: 'Avg Score', a: h2h.points1 / h2h.games, b: h2h.points2 / h2h.games },
                                    ].map((row) => (
                                        <div key={row.label} className="bg-bg-2 rounded-md p-3 border border-line">
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{row.label}</span>
                                                <span className="tnum text-text-dim">
                                                    <span className="text-signal">{row.a.toFixed(1)}</span>
                                                    <span className="text-text-mute"> vs </span>
                                                    <span className="text-signal-2">{row.b.toFixed(1)}</span>
                                                </span>
                                            </div>
                                            <div className="w-full bg-bg-3 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="bg-signal h-1.5"
                                                    style={{ width: `${(row.a / (row.a + row.b || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6">
                                    <h4 className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-3">Matchup History</h4>
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                        {h2h.history.map((game, i) => (
                                            <div
                                                key={`${game.season}-${game.week}-${i}`}
                                                className="grid items-center gap-2 p-2.5 bg-bg-2 rounded-md text-sm border border-line"
                                                style={{ gridTemplateColumns: '90px 1fr auto 1fr' }}
                                            >
                                                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute tnum">
                                                    {game.season} W{game.week}
                                                    {game.isPlayoff && <span className="text-signal-2"> PO</span>}
                                                </div>
                                                <div className={`tnum text-right ${game.winner === user1Id ? 'text-signal font-bold' : 'text-text-dim'}`}>
                                                    {game.score1.toFixed(1)}
                                                </div>
                                                <div className="text-text-mute px-1" aria-hidden="true">·</div>
                                                <div className={`tnum ${game.winner === user2Id ? 'text-signal-2 font-bold' : 'text-text-dim'}`}>
                                                    {game.score2.toFixed(1)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 font-mono text-2xs uppercase tracking-wider text-text-mute">
                                {user1Id && user2Id
                                    ? 'These two have never met in this scope'
                                    : 'Select two teams to view head-to-head history'}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <label className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Sort by
                            </label>
                            <SegmentedTabs
                                tabs={SORT_TABS}
                                value={sortKey}
                                onChange={setSortKey}
                                className="sm:w-80"
                            />
                        </div>

                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute tnum">
                            {board.length} rivalries
                        </div>

                        <div className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
                            {board.map((r, i) => {
                                const record = r[scope];
                                const { w, l, t, g } = record;
                                const leadA = w > l;
                                const leadB = l > w;
                                const share = w + l > 0 ? (w / (w + l)) * 100 : 50;
                                return (
                                    <button
                                        key={pairKey(r.aId, r.bId)}
                                        type="button"
                                        onClick={() => openPair(r.aId, r.bId)}
                                        className="w-full min-h-[44px] text-left bg-bg-2 hover:bg-bg-3 border border-line rounded-md px-3 py-2.5 transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-signal"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-2xs text-text-mute tnum w-6 shrink-0">
                                                {i + 1}
                                            </span>
                                            <span className="flex-1 min-w-0 truncate text-sm font-semibold text-text">
                                                {nameOf(r.aId)}
                                            </span>
                                            <span className="tnum font-display text-base font-bold shrink-0 px-1">
                                                <span className={leadA ? 'text-signal' : 'text-text'}>{w}</span>
                                                <span className="text-text-mute">-</span>
                                                <span className={leadB ? 'text-signal-2' : 'text-text'}>{l}</span>
                                                {t > 0 && (
                                                    <>
                                                        <span className="text-text-mute">-</span>
                                                        <span className="text-text-dim">{t}</span>
                                                    </>
                                                )}
                                            </span>
                                            <span className="flex-1 min-w-0 truncate text-sm font-semibold text-text text-right">
                                                {nameOf(r.bId)}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="flex-1 bg-bg-3 rounded-full h-1.5 overflow-hidden">
                                                {g > 0 && (
                                                    <div className="bg-signal h-1.5" style={{ width: `${share}%` }} />
                                                )}
                                            </div>
                                            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute shrink-0 tnum">
                                                {g === 0 ? 'No meetings' : `${g} ${g === 1 ? 'mtg' : 'mtgs'}`}
                                                {scope === 'all' && record.playoffGames > 0
                                                    ? ` · ${record.playoffGames} PO`
                                                    : ''}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Frame>
    );
};

export default RivalryMatrix;
