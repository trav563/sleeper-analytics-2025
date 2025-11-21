import { ALL_NFL_TEAMS } from '../utils/nflData';

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
