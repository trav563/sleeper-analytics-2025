import { ALL_NFL_TEAMS, INDOOR_STADIUMS } from '../utils/nflData';

/**
 * Fetches the NFL schedule for a specific week from ESPN and determines which teams are on bye.
 * @param {number} weekNumber - The week number to fetch (e.g., 1, 2, 14).
 * @returns {Promise<string[]>} - A promise that resolves to an array of team abbreviations on bye.
 */
export const getTeamsOnBye = async (weekNumber) => {
    try {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}`);
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

        return byeTeams;

    } catch (error) {
        console.error("Error fetching bye weeks:", error);
        return []; // Return empty array on error to avoid breaking the app
    }
};

/**
 * Fetches game statuses for all NFL teams in a specific week.
 * @param {number} weekNumber - The week number to fetch.
 * @returns {Promise<Object>} - A map of team abbreviation to game status: 'scheduled', 'in_progress', 'final', or 'bye'
 */
export const getGameStatuses = async (weekNumber) => {
    try {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}`);
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
 * Fetches game weather conditions for outdoor stadiums.
 * @param {number} weekNumber - The week number to fetch.
 * @returns {Promise<Object>} - Map of team abbreviation to weather info: { temp, condition, displayValue, isIndoor, isAdverse }
 */
export const getGameWeather = async (weekNumber) => {
    try {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}`);
        if (!response.ok) return {};

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

                const isIndoor = INDOOR_STADIUMS.has(abbr);

                if (isIndoor || !weather) {
                    weatherMap[abbr] = { isIndoor, isAdverse: false, displayValue: isIndoor ? 'Dome' : null };
                    return;
                }

                const temp = weather.temperature ? parseInt(weather.temperature) : null;
                const condition = weather.displayValue || '';
                const condLower = condition.toLowerCase();

                // Flag adverse conditions: cold (<35°F), wind mention, rain, snow
                const isAdverse = (temp !== null && temp < 35) ||
                    condLower.includes('rain') || condLower.includes('snow') ||
                    condLower.includes('storm') || condLower.includes('wind');

                weatherMap[abbr] = {
                    temp,
                    condition,
                    displayValue: weather.displayValue || null,
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
