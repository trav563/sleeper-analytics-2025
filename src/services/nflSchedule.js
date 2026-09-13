import { ALL_NFL_TEAMS, INDOOR_STADIUMS, getByeTeams } from '../utils/nflData';
import { rateLimitedFetch } from '../utils/rateLimitedFetch';

// No NFL week has ever had more than 6 teams on bye. A scoreboard implying
// more than this is a partial response, not a bye-heavy week.
const MAX_PLAUSIBLE_BYE_TEAMS = 8;

/**
 * Teams on bye for a given week.
 *
 * The generated schedule data (src/data/byeWeeks.json, refreshed with
 * `npm run update-byes`) is authoritative: it is season-aware, complete, and
 * cannot fail. ESPN is consulted only for seasons that data does not cover —
 * and since its scoreboard is season-blind, it can only stand in for the
 * season currently in progress.
 *
 * @param {number} weekNumber - The week number (e.g. 1, 2, 14).
 * @param {string|number} season - The league season, e.g. "2026".
 * @returns {Promise<string[]|null>} Team abbreviations on bye, or null when
 *   byes could not be determined. Callers must surface null rather than
 *   treating it as "nobody is on bye", which silently passes every lineup
 *   starting a bye-week player.
 */
export const getTeamsOnBye = async (weekNumber, season) => {
    const known = getByeTeams(season, weekNumber);
    if (known) return known;

    try {
        const response = await rateLimitedFetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}&seasontype=2${season ? `&dates=${season}` : ''}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch schedule: ${response.statusText}`);
        }

        const data = await response.json();
        const events = data.events || [];

        // Extract all teams playing this week
        const playingTeams = new Set();

        events.forEach(event => {
            event.competitions[0].competitors.forEach(competitor => {
                let abbr = competitor.team.abbreviation;

                // Normalize ESPN abbreviations to match Sleeper/ALL_NFL_TEAMS
                if (abbr === 'WSH') abbr = 'WAS';

                // Only add if it's a valid NFL team
                if (ALL_NFL_TEAMS.includes(abbr)) {
                    playingTeams.add(abbr);
                }
            });
        });

        // Compare against all teams to find who is missing
        const byeTeams = ALL_NFL_TEAMS.filter(team => !playingTeams.has(team));

        // An empty or truncated scoreboard reads as "most of the league is on
        // bye", which would flag every lineup in the app. Report unknown.
        if (byeTeams.length > MAX_PLAUSIBLE_BYE_TEAMS) {
            console.warn(`Bye lookup: week ${weekNumber} scoreboard looks incomplete (${byeTeams.length} teams absent)`);
            return null;
        }

        return byeTeams;

    } catch (error) {
        console.error("Error fetching bye weeks:", error);
        return null; // Unknown — never "nobody is on bye".
    }
};

/**
 * Fetches game statuses for all NFL teams in a specific week.
 * @param {number} weekNumber - The week number to fetch.
 * @returns {Promise<Object>} - A map of team abbreviation to game status: 'scheduled', 'in_progress', 'final', or 'bye'
 */
export const getGameStatuses = async (weekNumber, season) => {
    try {
        const response = await rateLimitedFetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}&seasontype=2${season ? `&dates=${season}` : ''}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch schedule: ${response.statusText}`);
        }

        const data = await response.json();
        const events = data.events || [];

        const statusMap = {};

        events.forEach(event => {
            const competition = event.competitions[0];
            const status = competition.status.type.name; // e.g., "STATUS_SCHEDULED", "STATUS_IN_PROGRESS", "STATUS_FINAL"

            let gameStatus;
            if (status === 'STATUS_SCHEDULED' || status === 'STATUS_POSTPONED') {
                gameStatus = 'scheduled';
            } else if (status === 'STATUS_IN_PROGRESS' || status === 'STATUS_HALFTIME') {
                gameStatus = 'in_progress';
            } else if (status === 'STATUS_FINAL' || status === 'STATUS_FULL_TIME') {
                gameStatus = 'final';
            } else {
                gameStatus = 'unknown';
            }

            competition.competitors.forEach(competitor => {
                let abbr = competitor.team.abbreviation;

                // Normalize ESPN abbreviations to match Sleeper
                if (abbr === 'WSH') abbr = 'WAS';

                if (ALL_NFL_TEAMS.includes(abbr)) {
                    statusMap[abbr] = gameStatus;
                }
            });
        });

        // Mark teams not in the schedule as on bye
        ALL_NFL_TEAMS.forEach(team => {
            if (!statusMap[team]) {
                statusMap[team] = 'bye';
            }
        });

        return statusMap;

    } catch (error) {
        console.error("Error fetching game statuses:", error);
        return {}; // Return empty object on error
    }
};

/**
 * Fetches per-team live game details (period, clock, score, status name).
 * Map keyed by NFL team abbreviation. Used for live broadcast eyebrows
 * ("Q3 9:42") and per-row live indicators on rosters / matchups.
 *
 * @param {number} weekNumber
 * @returns {Promise<Object>} { [abbr]: { period, displayClock, score, statusName, opponent, isHome } }
 */
export const getGameLiveDetails = async (weekNumber, season) => {
    try {
        const response = await rateLimitedFetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}&seasontype=2${season ? `&dates=${season}` : ''}`);
        if (!response.ok) throw new Error('Game context unavailable');

        const data = await response.json();
        const events = data.events || [];
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
    } catch (error) {
        console.error('Error fetching game live details:', error);
        throw error;
    }
};

/**
 * Fetches game weather conditions for outdoor stadiums.
 * @param {number} weekNumber - The week number to fetch.
 * @returns {Promise<Object>} - Map of team abbreviation to weather info: { temp, condition, displayValue, isIndoor, isAdverse }
 */
export const getGameWeather = async (weekNumber, season) => {
    try {
        const response = await rateLimitedFetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}&seasontype=2${season ? `&dates=${season}` : ''}`);
        if (!response.ok) throw new Error('Game context unavailable');

        const data = await response.json();
        const events = data.events || [];
        const weatherMap = {};

        events.forEach(event => {
            const weather = event.weather;
            const competition = event.competitions?.[0];
            if (!competition) return;

            competition.competitors.forEach(competitor => {
                let abbr = competitor.team.abbreviation;
                if (abbr === 'WSH') abbr = 'WAS';
                if (!ALL_NFL_TEAMS.includes(abbr)) return;

                const homeTeam = competition.competitors.find(c => c.homeAway === 'home')?.team?.abbreviation;
                const isIndoor = competition.venue?.indoor ?? INDOOR_STADIUMS.has(homeTeam === 'WSH' ? 'WAS' : homeTeam);

                if (isIndoor || !weather) {
                    weatherMap[abbr] = { isIndoor, isAdverse: false, displayValue: isIndoor ? 'Dome' : null };
                    return;
                }

                const temp = weather.temperature ? parseInt(weather.temperature) : null;
                const condition = weather.conditionId ? (weather.link?.text || '') : (weather.displayValue || '');
                const condLower = condition.toLowerCase();

                // Flag adverse conditions: cold (<35°F), wind mention, rain, snow
                const isAdverse = (temp !== null && temp < 35) ||
                    condLower.includes('rain') || condLower.includes('snow') ||
                    condLower.includes('storm') || condLower.includes('wind');

                weatherMap[abbr] = {
                    temp,
                    condition,
                    displayValue: /^\d+$/.test(String(weather.displayValue)) ? (weather.link?.text || null) : (weather.displayValue || null),
                    isIndoor: false,
                    isAdverse,
                };
            });
        });

        return weatherMap;
    } catch (error) {
        console.error("Error fetching game weather:", error);
        return {};
    }
};
