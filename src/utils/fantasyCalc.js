const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

/**
 * Fetch Dynasty Market Values from FantasyCalc
 * @param {boolean} isSuperflex
 * @param {number} numTeams
 * @param {number} ppr
 * @returns {Promise<Object>} Map of sleeper_id -> value
 */
export const fetchMarketValues = async (isSuperflex = true, numTeams = 12, ppr = 0.5) => {
    try {
        const numQbs = isSuperflex ? 2 : 1;
        const url = `${FANTASY_CALC_API}?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch FantasyCalc values');

        const data = await response.json();

        // Map to sleeper_id -> value (0-10000 approx scale)
        const valueMap = {};

        data.forEach(player => {
            if (player.sleeperId) {
                valueMap[player.sleeperId] = player.value;
            }
        });

        return valueMap;
    } catch (error) {
        console.error('Error fetching market values:', error);
        return {}; // Return empty on fail to gracefully fallback
    }
};
