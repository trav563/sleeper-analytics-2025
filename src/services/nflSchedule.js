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
                // ESPN uses abbreviations like 'BUF', 'NE', etc.
                // We need to ensure they match our internal format if necessary.
                // Usually ESPN abbrevs are standard.
                playingTeams.add(competitor.team.abbreviation);
            });
        });

        // Compare against all teams to find who is missing
        const byeTeams = ALL_NFL_TEAMS.filter(team => !playingTeams.has(team));

        // Map ESPN abbreviations to Sleeper if there are discrepancies
        // For now, we assume standard abbreviations match mostly.
        // Known potential diffs: WSH/WAS, JAC/JAX. 
        // Sleeper uses JAX, WAS. ESPN uses WSH, JAX.
        // Let's normalize.

        return byeTeams.map(team => {
            if (team === 'WSH') return 'WAS';
            return team;
        });

    } catch (error) {
        console.error("Error fetching bye weeks:", error);
        return []; // Return empty array on error to avoid breaking the app
    }
};
