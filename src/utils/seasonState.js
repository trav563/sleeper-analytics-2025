/**
 * Season/week derivation shared by the league layout and every page.
 *
 * Sleeper's /state/nfl reports preseason with `season_type: 'pre'` and a
 * `display_week` that counts PRESEASON weeks (e.g. 2 in mid-August). Reading
 * display_week blindly presents that as the current regular-season week, which
 * is what made the dashboard say "Week 2 (Current)" and let The Roast build a
 * recap out of games that never happened.
 */

/** Season types where regular-season games have been played (or are being played). */
const LIVE_TYPES = new Set(['regular', 'post']);

/** True once the league's own season is under way. Past seasons count as started. */
export function isSeasonStarted(league, state) {
    const leagueSeason = league?.season ? Number(league.season) : null;
    const nflSeason = state?.season ? Number(state.season) : null;
    if (leagueSeason && nflSeason && leagueSeason < nflSeason) return true; // history
    if (leagueSeason && nflSeason && leagueSeason > nflSeason) return false; // not yet
    if (!state?.season_type) return false; // unknown state: assume not started
    return LIVE_TYPES.has(state.season_type);
}

/**
 * For past seasons anchor to end-of-regular-season; for the live season use NFL
 * state; before kickoff anchor to week 1 rather than a preseason week number.
 */
export function deriveCurrentWeek(league, state) {
    const leagueSeason = league?.season ? Number(league.season) : null;
    const nflSeason = state?.season ? Number(state.season) : null;
    const isHistoricalSeason = leagueSeason && nflSeason && leagueSeason < nflSeason;
    if (isHistoricalSeason) {
        return league?.settings?.playoff_week_start
            ? league.settings.playoff_week_start - 1
            : 17;
    }
    if (!isSeasonStarted(league, state)) return 1;
    return state?.display_week ?? state?.week ?? state?.leg ?? 1;
}
