import { getMarketPickValue } from '../../../utils/fantasyCalc';

export const ordinal = (n) => {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return `${n}th`;
};

// Pick value fallback (standardized 0-10,000 scale) — used when the
// FantasyCalc market map has no entry for the pick.
export const getPickValue = (round, rankInsideLeague, totalTeams, isSuperflex = true) => {
    // Rank 1 = 1.01 (Highest Value)

    if (round === 1) {
        if (rankInsideLeague <= 3) return 7000; // Early 1st
        if (rankInsideLeague <= 8) return 5500; // Mid 1st
        return 4500; // Late 1st
    }

    if (round === 2) {
        if (rankInsideLeague <= 4) return 2800; // Early 2nd
        if (rankInsideLeague <= 8) return 2200; // Mid 2nd
        return 1600; // Late 2nd
    }

    if (round === 3) return 600;
    if (round === 4) return 200;

    return 150; // Fallback
};

/**
 * Build the future rookie-pick ledger for a league: every roster's picks for
 * the next two draft years across the league's rookie-draft rounds, with
 * traded_picks applied and each pick priced (FantasyCalc market value first,
 * formula tiers as fallback). Pick tier comes from the original owner's
 * projected draft slot (reverse Max PF order).
 *
 * @returns {{ allPicks: Array, ledgerByRoster: Object }}
 */
export function buildPickLedger(league, rosters, tradedPicks, marketValues = {}, isSuperflex = true) {
    if (!league || !Array.isArray(rosters) || rosters.length === 0) {
        return { allPicks: [], ledgerByRoster: {} };
    }

    const totalTeams = rosters.length;
    const currentYear = parseInt(league.season);

    // Ledger covers the league's actual rookie-draft rounds (capped at 5
    // so deep drafts don't flood the trade pool with near-zero picks).
    const draftRounds = Math.min(league.settings?.draft_rounds || 3, 5);
    const ledgerRounds = Array.from({ length: draftRounds }, (_, i) => i + 1);

    const allPicks = [];
    rosters.forEach(r => {
        [currentYear + 1, currentYear + 2].forEach(year => {
            ledgerRounds.forEach(round => {
                allPicks.push({
                    id: `pick-${year}-${round}-${r.roster_id}`,
                    loading_id: `pick-${year}-${round}-${r.roster_id}`, // unique key
                    year,
                    round,
                    original_owner_id: r.roster_id,
                    roster_id: r.roster_id, // Current Owner
                    type: 'Pick'
                });
            });
        });
    });

    // Apply trades (traded_picks.owner_id is the acquiring ROSTER id)
    if (tradedPicks) {
        tradedPicks.forEach(tp => {
            const year = parseInt(tp.season);
            const pick = allPicks.find(p =>
                p.year === year &&
                p.round === tp.round &&
                p.original_owner_id === tp.roster_id
            );
            if (pick) pick.roster_id = tp.owner_id;
        });
    }

    // Projected draft order = reverse Max PF (worst team picks first).
    const draftOrder = rosters
        .map(r => ({ rosterId: r.roster_id, ppts: r.settings?.ppts || 0 }))
        .sort((a, b) => a.ppts - b.ppts);

    allPicks.forEach(p => {
        const draftIndex = draftOrder.findIndex(d => d.rosterId === p.original_owner_id);
        const rank = draftIndex !== -1 ? draftIndex + 1 : 6; // default mid

        let qual = 'Mid';
        if (rank <= 4) qual = 'Early';
        else if (rank >= 9) qual = 'Late';

        // Market value first (FantasyCalc carries pick prices, including a
        // real future-year discount); formula tiers as fallback.
        p.tradeValue = getMarketPickValue(marketValues, {
            year: p.year,
            round: p.round,
            rank,
            tier: qual.toLowerCase(),
        }) ?? getPickValue(p.round, rank, totalTeams, isSuperflex);

        p.description = `${p.year} ${ordinal(p.round)} (${qual})`;
        p.full_name = p.description; // Consistency with players
    });

    const ledgerByRoster = {};
    allPicks.forEach(p => {
        if (!ledgerByRoster[p.roster_id]) ledgerByRoster[p.roster_id] = [];
        ledgerByRoster[p.roster_id].push(p);
    });

    return { allPicks, ledgerByRoster };
}
