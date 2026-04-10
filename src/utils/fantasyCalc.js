/**
 * Fetch Dynasty Market Values via our server proxy (avoids CORS issues)
 * @param {boolean} isSuperflex
 * @param {number} numTeams
 * @param {number} ppr
 * @returns {Promise<Object>} Map of sleeper_id -> value
 */
export const fetchMarketValues = async (isSuperflex = true, numTeams = 12, ppr = 0.5) => {
    try {
        const numQbs = isSuperflex ? 2 : 1;
        const url = `/api/market-values?numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch market values');

        return await response.json();
    } catch (error) {
        console.error('Error fetching market values:', error);
        return {}; // Return empty on fail to gracefully fallback
    }
};
