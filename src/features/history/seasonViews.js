import { displayTeamName } from '../../utils/nflData';

/**
 * Reshape the league chain plus its fetched matchups into the per-season view
 * the history calculators take: one entry per season, each able to turn a
 * roster_id into the manager behind it.
 *
 * Shared by the record book and the perfect-weeks panel so both resolve
 * managers the same way — current-league users first for the freshest names,
 * that season's users as a fallback so departed managers still resolve.
 */
export function toSeasonViews(leagueHistory, historicalMatchups, users) {
    return (leagueHistory || [])
        .map(league => {
            const entry = historicalMatchups?.[league.league_id];
            if (!entry) return null;
            const seasonUsers = entry.users || [];
            const findUser = ownerId =>
                users?.find(u => u.user_id === ownerId) || seasonUsers.find(u => u.user_id === ownerId);

            return {
                season: league.season,
                slots: league.roster_positions,
                playoffWeekStart: league.playoff_week_start,
                weeks: entry.weeks,
                resolveTeam: rosterId => {
                    const roster = Object.values(league.rosters || {}).find(r => r.roster_id === rosterId);
                    const user = findUser(roster?.owner_id);
                    return {
                        key: roster?.owner_id || `roster-${rosterId}`,
                        name: displayTeamName(user),
                        avatar: user?.avatar,
                    };
                },
            };
        })
        .filter(Boolean);
}
