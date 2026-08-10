import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { displayTeamName } from '../../../utils/nflData';
import { Swords, Download } from 'lucide-react';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Button } from '../../../components/ui/Button';
import { useRivalries } from '../hooks/useRivalries';
import RivalryManagerTable from './RivalryManagerTable';
import {
    pairKey,
    bucketRivalries,
    buildManagerSplits,
    MIN_BUCKET_MEETINGS,
    RIVALRY_BUCKETS,
    RIVALRY_BUCKET_LABELS,
    RIVALRY_SCOPE_LABELS,
} from '../../../utils/rivalries';
import { toCSV, csvFilename, csvSlug, downloadCSV } from '../../../utils/csv';
import {
    buildH2HCsvRows,
    buildBucketCsvRows,
    buildManagerCsvRows,
} from '../utils/rivalryCsv';

const SCOPE_TABS = [
    { value: 'reg', label: RIVALRY_SCOPE_LABELS.reg },
    { value: 'all', label: RIVALRY_SCOPE_LABELS.all },
];

const VIEW_TABS = [
    { value: 'h2h', label: 'Head-to-Head', short: 'H2H' },
    { value: 'matrix', label: 'All Rivalries', short: 'All' },
    { value: 'manager', label: 'One vs All', short: 'Vs All' },
];

const Frame = ({ children }) => (
    <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">{children}</section>
);

const MessageBox = ({ children }) => (
    <Frame>
        <div className="p-8 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">{children}</div>
    </Frame>
);

/**
 * Bucket selector. Not SegmentedTabs: that component sets gridTemplateColumns as
 * an inline style, so className can't give it the 2x2 mobile layout four labels
 * plus counts need at 375px. Same token family, 44px targets.
 */
const BucketTabs = ({ value, counts, onChange }) => (
    <div
        role="tablist"
        aria-label="Rivalry group"
        className="grid grid-cols-2 md:grid-cols-4 gap-1 bg-bg-2 rounded-lg p-1 border border-line"
    >
        {RIVALRY_BUCKETS.map((b) => {
            const active = b === value;
            return (
                <button
                    key={b}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onChange(b)}
                    className={`min-h-[44px] px-2 rounded-md text-sm font-semibold transition-colors duration-fast flex items-center justify-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-signal ${
                        active ? 'bg-bg-3 text-signal' : 'text-text-dim hover:text-text'
                    }`}
                >
                    <span>{RIVALRY_BUCKET_LABELS[b]}</span>
                    <span className="tnum font-mono text-2xs text-text-mute">{counts[b]}</span>
                </button>
            );
        })}
    </div>
);

const RivalryMatrix = ({
    currentUserId,
    users,
    selectedUser1Id,
    selectedUser2Id,
    leagueId,
    leagueName,
}) => {
    const { leagueHistory, loadHistory, user } = useSleeper();
    const [viewMode, setViewMode] = useState('h2h');
    const [scope, setScope] = useState('reg');
    const [bucket, setBucket] = useState('closest');
    const [user1Id, setUser1Id] = useState(currentUserId);
    const [user2Id, setUser2Id] = useState('');
    // Separate from user1Id on purpose: sharing it would let picking a manager
    // here overwrite Team A, and if that manager were already Team B the H2H tab
    // would end up with an impossible same-owner pair.
    const [managerId, setManagerId] = useState(currentUserId);

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

    // Membership signature. Routes are `league/:leagueId` with no key, so this
    // component stays mounted across a league switch — without watching the owner
    // set, a manager picked in the previous league survives into one they are not
    // in, leaving a select holding a value absent from its own options.
    const ownerSig = useMemo(() => currentOwnerIds.join(','), [currentOwnerIds]);

    // Track the parent's pickers so the selected pair follows them. Adjusting
    // state during render is React's supported pattern for "reset state when a
    // prop changes"; an effect here would cost an extra cascading render.
    const [syncedFrom, setSyncedFrom] = useState({ a: null, b: null, me: null, owners: '' });
    if (
        syncedFrom.a !== selectedUser1Id ||
        syncedFrom.b !== selectedUser2Id ||
        syncedFrom.me !== currentUserId ||
        syncedFrom.owners !== ownerSig
    ) {
        setSyncedFrom({
            a: selectedUser1Id,
            b: selectedUser2Id,
            me: currentUserId,
            owners: ownerSig,
        });

        // Until the owner set is known, keep whatever is selected rather than
        // clearing it on first render.
        const members = new Set(currentOwnerIds);
        const stillHere = (id) => !!id && (members.size === 0 || members.has(id));

        // The parent's pickers are validated too. They read from useLeagueData,
        // which can lag leagueHistory during a league change, so an incoming prop
        // is just as capable of naming a non-member as our own stale state is.
        const propUser1 = stillHere(selectedUser1Id) ? selectedUser1Id : null;
        const propUser2 = stillHere(selectedUser2Id) ? selectedUser2Id : null;
        // The viewer is not necessarily in the league they are looking at.
        const fallback = stillHere(currentUserId) ? currentUserId : currentOwnerIds[0] || '';

        const nextUser1 = propUser1 || (stillHere(user1Id) ? user1Id : fallback);
        if (nextUser1 !== user1Id) setUser1Id(nextUser1);

        const nextUser2 = propUser2 || (stillHere(user2Id) ? user2Id : '');
        if (nextUser2 !== user2Id) setUser2Id(nextUser2);
        // Only jump to the pair view for an opponent that actually exists here.
        if (propUser2) setViewMode('h2h');

        const nextManager = propUser1 || (stillHere(managerId) ? managerId : fallback);
        if (nextManager !== managerId) setManagerId(nextManager);
    }

    useEffect(() => {
        if (!leagueHistory && leagueId) {
            loadHistory(leagueId, user?.user_id);
        }
    }, [leagueHistory, leagueId, user, loadHistory]);

    // Every pair lands in exactly one bucket, so the four counts sum to the total.
    // Membership is scope-dependent — a pair can legitimately move when switching.
    const buckets = useMemo(() => bucketRivalries(rivalries, scope), [rivalries, scope]);
    const bucketRows = buckets[bucket];
    const bucketCounts = useMemo(() => {
        const counts = {};
        RIVALRY_BUCKETS.forEach((b) => {
            counts[b] = buckets[b].length;
        });
        return counts;
    }, [buckets]);

    const managerSplit = useMemo(
        () => buildManagerSplits({ rivalries, ownerId: managerId, scope }),
        [rivalries, managerId, scope]
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

    const canExport =
        viewMode === 'h2h'
            ? !!h2h && h2h.games > 0
            : viewMode === 'matrix'
              ? bucketRows.length > 0
              : !!managerId && managerSplit.rows.length > 0;

    // Rows are built on click rather than in a memo: no reason to assemble three
    // CSVs on every render.
    const handleExport = () => {
        const league = leagueName || leagueHistory?.[0]?.name;
        let prefix;
        let rows;

        if (viewMode === 'h2h') {
            prefix = `h2h_${scope}`;
            rows = buildH2HCsvRows({
                leagueName: league,
                scope,
                nameA: nameOf(user1Id),
                nameB: nameOf(user2Id),
                h2h,
            });
        } else if (viewMode === 'matrix') {
            prefix = `rivalries_${bucket}_${scope}`;
            rows = buildBucketCsvRows({
                leagueName: league,
                scope,
                bucket,
                entries: bucketRows,
                nameOf,
            });
        } else {
            prefix = `manager_${csvSlug(nameOf(managerId), 'team')}_${scope}`;
            rows = buildManagerCsvRows({
                leagueName: league,
                scope,
                managerName: nameOf(managerId),
                split: managerSplit,
                nameOf,
            });
        }

        downloadCSV(toCSV(rows), csvFilename(prefix, league));
    };

    if (error) return <MessageBox>Could not load rivalry history</MessageBox>;
    if (loading) return (
        <Frame>
            <div className="p-5 space-y-4" aria-busy="true">
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute text-center">
                    Loading rivalry history…
                </p>
                <div className="flex gap-2">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 flex-1" />)}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-40 w-full" />
            </div>
        </Frame>
    );
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
                        tabs={VIEW_TABS.map((t) => ({
                            value: t.value,
                            label: (
                                <>
                                    <span className="md:hidden">{t.short}</span>
                                    <span className="hidden md:inline">{t.label}</span>
                                </>
                            ),
                        }))}
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
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute flex-1">
                        {scopeNote} · consolation excluded
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={!canExport}
                        className="gap-1 border-line text-text hover:bg-bg-2 min-h-[44px] self-start sm:self-auto"
                    >
                        <Download className="w-3 h-3" aria-hidden="true" />
                        CSV
                    </Button>
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
                ) : viewMode === 'manager' ? (
                    <div className="space-y-4">
                        <div className="w-full md:w-72">
                            <label
                                htmlFor="rivalry-manager"
                                className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1"
                            >
                                Manager
                            </label>
                            <select
                                id="rivalry-manager"
                                className="w-full bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                                value={managerId || ''}
                                onChange={(e) => setManagerId(e.target.value)}
                            >
                                <option value="" disabled>Select a manager</option>
                                {users?.map((u) => (
                                    <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                ))}
                            </select>
                        </div>

                        {managerId ? (
                            <RivalryManagerTable
                                seasons={managerSplit.seasons}
                                rows={managerSplit.rows}
                                total={managerSplit.total}
                                nameOf={nameOf}
                                scope={scope}
                                ownerId={managerId}
                                onOpenPair={openPair}
                            />
                        ) : (
                            <div className="text-center py-10 font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Select a manager to see every head-to-head at once
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <BucketTabs value={bucket} counts={bucketCounts} onChange={setBucket} />

                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute tnum">
                                {bucketRows.length} of {rivalries.length} pairs
                            </div>
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Group depends on scope — a pair can move when you switch
                            </div>
                        </div>

                        {bucketRows.length === 0 ? (
                            <div className="text-center py-10 font-mono text-2xs uppercase tracking-wider text-text-mute space-y-1">
                                <p>
                                    No pairs in {RIVALRY_BUCKET_LABELS[bucket]} for{' '}
                                    {RIVALRY_SCOPE_LABELS[scope]}
                                </p>
                                {bucket !== 'thin' && (
                                    <p>
                                        Groups need {MIN_BUCKET_MEETINGS}+ meetings — try Thin Sample
                                    </p>
                                )}
                            </div>
                        ) : (
                        <div className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
                            {bucketRows.map((r, i) => {
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
                        )}
                    </div>
                )}
            </div>
        </Frame>
    );
};

export default RivalryMatrix;
