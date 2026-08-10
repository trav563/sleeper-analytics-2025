import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { fetchDraftPicks } from '../../../utils/sleeper';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';

// Position tones mirror GMPerformance's POSITION_FILL token mapping.
const POS_TONE = {
    QB: 'text-bad border-bad/30 bg-bad/10',
    RB: 'text-good border-good/30 bg-good/10',
    WR: 'text-signal border-signal/30 bg-signal/10',
    TE: 'text-signal-2 border-signal-2/30 bg-signal-2/10',
    K: 'text-warn border-warn/30 bg-warn/10',
    DEF: 'text-text-dim border-line bg-bg-2',
};

const STATUS_LABEL = {
    pre_draft: 'Upcoming',
    drafting: 'LIVE',
    paused: 'Paused',
    complete: 'Complete',
};

/**
 * Rookie / startup draft board.
 * - pre_draft: projected board — draft_order slots with traded-pick ownership
 *   overlaid from traded_picks.
 * - drafting: actual picks so far, polled every 20s.
 * - complete: full results grid.
 */
const DraftBoard = ({ league, rosters, users, drafts, tradedPicks }) => {
    const sortedDrafts = useMemo(
        () => [...(drafts || [])].sort((a, b) => Number(b.season) - Number(a.season) || (b.start_time || 0) - (a.start_time || 0)),
        [drafts]
    );
    const [selectedId, setSelectedId] = useState(null);
    const draft = sortedDrafts.find(d => d.draft_id === selectedId) || sortedDrafts[0];

    const isLive = draft?.status === 'drafting';
    const { data: picks } = useQuery({
        queryKey: ['draftPicks', draft?.draft_id],
        queryFn: () => fetchDraftPicks(draft.draft_id),
        enabled: !!draft && draft.status !== 'pre_draft',
        staleTime: isLive ? 15 * 1000 : 60 * 60 * 1000,
        refetchInterval: isLive ? 20 * 1000 : false,
    });

    const userById = useMemo(() => {
        const map = {};
        (users || []).forEach(u => { map[u.user_id] = u; });
        return map;
    }, [users]);

    const rosterByUserId = useMemo(() => {
        const map = {};
        (rosters || []).forEach(r => {
            if (r.owner_id) map[r.owner_id] = r;
            (r.co_owners || []).forEach(id => { if (!map[id]) map[id] = r; });
        });
        return map;
    }, [rosters]);

    const userByRosterId = useMemo(() => {
        const map = {};
        (rosters || []).forEach(r => { map[r.roster_id] = userById[r.owner_id]; });
        return map;
    }, [rosters, userById]);

    /* slot -> user for the selected draft (from draft_order user_id -> slot). */
    const slotUsers = useMemo(() => {
        const map = {};
        Object.entries(draft?.draft_order || {}).forEach(([userId, slot]) => {
            map[slot] = userById[userId];
        });
        return map;
    }, [draft, userById]);

    const rounds = draft?.settings?.rounds || 0;
    const slots = draft?.settings?.teams || rosters?.length || 0;

    /* Projected pre-draft board: each cell is the slot owner's pick unless a
       traded_picks entry for this season moved it. */
    const projectedBoard = useMemo(() => {
        if (!draft || draft.status !== 'pre_draft') return null;
        const board = [];
        for (let round = 1; round <= rounds; round++) {
            const row = [];
            for (let slot = 1; slot <= slots; slot++) {
                const originalUser = slotUsers[slot];
                const originalRoster = originalUser ? rosterByUserId[originalUser.user_id] : null;
                let owner = originalUser;
                let traded = false;
                if (originalRoster && tradedPicks) {
                    const trade = tradedPicks.find(tp =>
                        tp.season === draft.season &&
                        tp.round === round &&
                        tp.roster_id === originalRoster.roster_id
                    );
                    if (trade) {
                        owner = userByRosterId[trade.owner_id] || owner;
                        traded = trade.owner_id !== originalRoster.roster_id;
                    }
                }
                row.push({ slot, owner, original: originalUser, traded });
            }
            board.push(row);
        }
        return board;
    }, [draft, rounds, slots, slotUsers, rosterByUserId, userByRosterId, tradedPicks]);

    /* Results board keyed round -> slot. */
    const pickBoard = useMemo(() => {
        if (!picks) return null;
        const map = {};
        picks.forEach(p => { map[`${p.round}-${p.draft_slot}`] = p; });
        return map;
    }, [picks]);

    if (!draft) return null;

    const statusLabel = STATUS_LABEL[draft.status] || draft.status;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-signal" aria-hidden="true" />
                        <h3 className="font-display text-lg font-semibold text-text">Draft Board</h3>
                        {isLive && (
                            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-signal-2 bg-signal-2/15 px-2 py-0.5 rounded-sm animate-pulse">
                                LIVE
                            </span>
                        )}
                    </div>
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                        {draft.season} · {rounds} rounds · {statusLabel}
                    </p>
                </div>
                {sortedDrafts.length > 1 && (
                    <select
                        aria-label="Select draft"
                        value={draft.draft_id}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="px-3 py-2 rounded-md border border-line bg-bg-2 text-text text-sm focus:outline-none focus:ring-1 focus:ring-signal min-h-[44px]"
                    >
                        {sortedDrafts.map(d => (
                            <option key={d.draft_id} value={d.draft_id}>
                                {d.season} {STATUS_LABEL[d.status] || d.status}
                            </option>
                        ))}
                    </select>
                )}
            </header>

            <div className="overflow-x-auto p-4">
                {draft.status === 'pre_draft' && projectedBoard && (
                    <div className="space-y-3 min-w-[640px]">
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                            Projected order · gold ring = acquired via trade
                        </p>
                        {projectedBoard.map((row, roundIdx) => (
                            <div key={roundIdx} className="flex items-center gap-1.5">
                                <span className="font-mono text-2xs font-bold text-text-mute w-8 shrink-0 tnum">R{roundIdx + 1}</span>
                                {row.map(cell => (
                                    <div
                                        key={cell.slot}
                                        className={`flex-1 min-w-0 rounded-md border p-1.5 text-center ${cell.traded ? 'border-signal/60 bg-signal/5' : 'border-line bg-bg-2'}`}
                                        title={cell.traded
                                            ? `${roundIdx + 1}.${String(cell.slot).padStart(2, '0')} — ${displayTeamName(cell.owner)} (from ${displayTeamName(cell.original)})`
                                            : `${roundIdx + 1}.${String(cell.slot).padStart(2, '0')} — ${displayTeamName(cell.owner)}`}
                                    >
                                        <div className="flex justify-center mb-1">
                                            {cell.owner?.avatar ? (
                                                <img src={avatarUrl(cell.owner.avatar)} alt="" loading="lazy" className="w-6 h-6 rounded-full ring-1 ring-line" />
                                            ) : (
                                                <Pip seed={cell.owner?.user_id ?? cell.slot} name={displayTeamName(cell.owner)} size={24} />
                                            )}
                                        </div>
                                        <div className="font-mono text-2xs text-text-mute tnum">{roundIdx + 1}.{String(cell.slot).padStart(2, '0')}</div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {draft.status !== 'pre_draft' && (
                    <div className="space-y-3 min-w-[720px]">
                        {Array.from({ length: rounds }, (_, r) => r + 1).map(round => (
                            <div key={round} className="flex items-stretch gap-1.5">
                                <span className="font-mono text-2xs font-bold text-text-mute w-8 shrink-0 tnum self-center">R{round}</span>
                                {Array.from({ length: slots }, (_, s) => s + 1).map(slot => {
                                    const pick = pickBoard?.[`${round}-${slot}`];
                                    const md = pick?.metadata;
                                    const tone = POS_TONE[md?.position] || 'text-text-dim border-line bg-bg-2';
                                    const picker = pick ? (userById[pick.picked_by] || userByRosterId[pick.roster_id]) : null;
                                    return (
                                        <div
                                            key={slot}
                                            className={`flex-1 min-w-0 rounded-md border p-1.5 ${pick ? tone : 'border-dashed border-line bg-bg-2/40'}`}
                                            title={pick ? `${round}.${String(slot).padStart(2, '0')} ${md?.first_name} ${md?.last_name} — ${displayTeamName(picker)}` : `${round}.${String(slot).padStart(2, '0')} on the clock`}
                                        >
                                            <div className="font-mono text-2xs text-text-mute tnum">{round}.{String(slot).padStart(2, '0')}</div>
                                            {pick ? (
                                                <>
                                                    <div className="text-xs font-semibold truncate text-text">
                                                        {md?.first_name?.[0]}. {md?.last_name}
                                                    </div>
                                                    <div className="font-mono text-2xs truncate">
                                                        {md?.position} · {md?.team || 'FA'}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-xs text-text-mute italic">—</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default DraftBoard;
