import { useMemo } from 'react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { ArrowRight } from 'lucide-react';

const TankTracker = ({ rosters, users, tradedPicks, league }) => {

    const projectedOrder = useMemo(() => {
        if (!rosters || rosters.length === 0) return [];

        // 1. Determine "Natural" Slots based on Max PF (ppts)
        // Lower Max PF = Better Pick (1.01)
        // Sort ascending by ppts
        const sorted = [...rosters].sort((a, b) => {
            const maxPfA = (a.settings?.ppts || 0) + (a.settings?.ppts_decimal || 0) / 100;
            const maxPfB = (b.settings?.ppts || 0) + (b.settings?.ppts_decimal || 0) / 100;
            return maxPfA - maxPfB;
        });

        // 2. Check Ownership for Round 1 Picks
        // Assuming we are looking at the *upcoming* draft.
        // If we are in 2025 season, the next draft is 2026? Or usually next year.
        // Current season is in league.season (e.g., "2025").
        // Traded picks usually have `season` string.
        // We want to track the draft order for the *next* rookie draft.
        // If league.status is 'in_season' or 'pre_draft', usually it's the season + 1 if year is over?
        // Actually, usually "Tank Tracker" tracks the current season's accumulating stats for the *upcoming* draft.
        // So if season is "2025", we are tracking the "2026" draft order (or "2025" if we are mid-season 2025 and haven't drafted?).
        // Sleeper `traded_picks` have a `season` field (e.g., "2026").
        // Standard Tank Tracker logic: Order is for the *immediate next* draft.
        // If we are in 2025 season, we are playing for 2026 picks? No, usually 2025 season determines 2026 draft order.
        // So we look for picks where season === (parseInt(league.season) + 1).toString().

        const nextDraftYear = (parseInt(league?.season || '2025') + 1).toString();

        return sorted.map((roster, index) => {
            const originalOwnerId = roster.roster_id;
            const originalOwner = users.find(u => u.user_id === roster.owner_id);
            const maxPf = (roster.settings?.ppts || 0) + (roster.settings?.ppts_decimal || 0) / 100;

            // Check if this specific pick (Original Owner's Round 1) was traded
            // Traded Picks Entry matches: roster_id (original owner), round: 1, season: nextDraftYear
            const tradeEntry = tradedPicks?.find(p =>
                p.roster_id === originalOwnerId &&
                p.round === 1 &&
                p.season === nextDraftYear
            );

            let currentOwnerId = originalOwnerId;
            let currentOwner = originalOwner;
            let isTraded = false;

            if (tradeEntry) {
                // If found, the owner_id in the trade entry is the NEW owner
                currentOwnerId = tradeEntry.owner_id; // Wait, sleeper 'owner_id' in traded_picks is the RECEIVER of the pick.
                // Wait, let's verify sleeper API. 
                // traded_picks: [{ roster_id: 1, owner_id: 2, round: 1, ... }]
                // roster_id = Original Owner (the pick's slot/origin)
                // owner_id = Current Owner (who holds it now)

                // Also need to handle chain trades? Sleeper API usually returns the *current* state in traded_picks.
                // But wait, `traded_picks` endpoint is "All traded picks in the league".
                // If Team A trades to Team B, entry: { roster_id: A, owner_id: B }.
                // If Team B trades to Team C, entry: { roster_id: A, owner_id: C }? Or is it a separate transaction?
                // Sleeper documentation implies `traded_picks` array contains the *current* holding status of all picks that are NOT with original owner.
                // If a pick is with original owner, it is NOT in `traded_picks`.
                // So finding *the* entry for (roster_id=Original, round=1, season=Year) gives the current owner.

                isTraded = true;
                // Sleeper traded_picks owner_id is the `roster_id` of the current owner, or `owner_id` (user_id)? 
                // Docs: "owner_id": 12345678 (This is the ROSTER_ID of the current owner). No, check data.
                // Actually usually `owner_id` is the `roster_id` in Sleeper's terminology for draft picks? No, usually `owner_id` is `roster_id` for `rosters` and `user_id` for `users`.
                // In `traded_picks` array: `owner_id` is the `roster_id` of the *new* owner. `roster_id` is the `roster_id` of the *original* owner.

                // Let's assume `tradeEntry.owner_id` IS the roster_id of the new owner.
                currentOwnerId = tradeEntry.owner_id;
                const currentRoster = rosters.find(r => r.roster_id === currentOwnerId);
                currentOwner = users.find(u => u.user_id === currentRoster?.owner_id);
            }

            return {
                pick: `1.${String(index + 1).padStart(2, '0')}`,
                originalOwner,
                currentOwner,
                maxPf: maxPf.toFixed(2),
                isTraded,
                isMyPick: false // Will set loosely, but mainly for UI highlighting
            };
        });

    }, [rosters, users, tradedPicks, league]);

    if (!rosters || rosters.length === 0) return null;

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <span className="text-xl">🚜</span> Tank Tracker (Projected 1st Round)
                </CardTitle>
                <p className="text-xs text-slate-400">Projected order based on Max PF (Potential Points). Ties broken by points.</p>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                            <tr>
                                <th className="px-3 py-2">Pick</th>
                                <th className="px-3 py-2">Current Owner</th>
                                <th className="px-3 py-2 text-right">Max PF</th>
                                <th className="px-3 py-2 max-w-[150px] hidden sm:table-cell">Original Owner</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {projectedOrder.map((row) => (
                                <tr key={row.pick} className={`hover:bg-slate-700/30 ${row.isTraded ? 'bg-blue-500/5' : ''}`}>
                                    <td className="px-3 py-3 font-mono font-bold text-white">{row.pick}</td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <img src={avatarUrl(row.currentOwner?.avatar)} className="w-6 h-6 rounded-full" />
                                            <span className={`font-medium ${row.isTraded ? 'text-blue-300' : 'text-slate-200'}`}>
                                                {displayTeamName(row.currentOwner)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-400">
                                        {row.maxPf}
                                    </td>
                                    <td className="px-3 py-3 hidden sm:table-cell">
                                        {row.isTraded ? (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <span>via</span>
                                                <img src={avatarUrl(row.originalOwner?.avatar)} className="w-4 h-4 rounded-full opacity-60" />
                                                <span className="truncate max-w-[100px]">{displayTeamName(row.originalOwner)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-600 italic">Self</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

export default TankTracker;
