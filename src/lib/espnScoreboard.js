import { ALL_NFL_TEAMS } from '../utils/nflTeams.js';

export const espnScoreboardUrl = (week, season) =>
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2${season ? `&dates=${season}` : ''}`;

/**
 * Per-team live game details from an ESPN scoreboard response, keyed by NFL
 * team abbreviation. Pure so the browser and the server sampler read a game's
 * clock the same way.
 *
 * @returns {Object} { [abbr]: { period, displayClock, score, statusName, opponent, isHome, gameId, kickoff } }
 */
export function parseGameDetails(data) {
    const events = data?.events || [];
    const detailsMap = {};

    events.forEach((event) => {
        const competition = event.competitions?.[0];
        if (!competition) return;
        const gameStatus = competition.status || event.status;
        const status = gameStatus?.type?.name || 'STATUS_UNKNOWN';
        const period = gameStatus?.period ?? 0;
        const displayClock = gameStatus?.displayClock || '';
        const gameId = event.id || competition.id || null;
        const kickoff = event.date || competition.date || null;

        const competitors = competition.competitors || [];
        competitors.forEach((c) => {
            let abbr = c.team?.abbreviation;
            if (abbr === 'WSH') abbr = 'WAS';
            if (!abbr || !ALL_NFL_TEAMS.includes(abbr)) return;

            const opp = competitors.find((o) => o !== c);
            let oppAbbr = opp?.team?.abbreviation;
            if (oppAbbr === 'WSH') oppAbbr = 'WAS';

            detailsMap[abbr] = {
                period,
                displayClock,
                score: Number(c.score) || 0,
                statusName: status,
                opponent: oppAbbr || null,
                isHome: c.homeAway === 'home',
                gameId,
                kickoff,
            };
        });
    });

    return detailsMap;
}
