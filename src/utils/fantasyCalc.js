import { fetchSleeper } from './sleeper'; // Assuming we might need helpers or just standard fetch

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
        
        let data;
        
        // Try Vercel proxy first (works in production)
        try {
            const proxyUrl = `/api/fantasyCalc?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;
            const proxyResponse = await fetch(proxyUrl);
            if (!proxyResponse.ok) throw new Error('Proxy failed');
            data = await proxyResponse.json();
        } catch {
            // Fallback: fetch directly from FantasyCalc API (works in local dev)
            const directUrl = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;
            const directResponse = await fetch(directUrl);
            if (!directResponse.ok) throw new Error('Direct API failed');
            data = await directResponse.json();
        }

        // Map to sleeper_id -> value (0-10000 approx scale)
        const valueMap = {};

        data.forEach(item => {
            // FantasyCalc returns { player: { sleeperId, ... }, value }
            const sleeperId = item.player?.sleeperId || item.sleeperId;
            if (sleeperId) {
                valueMap[String(sleeperId)] = item.value;
            }
        });

        return valueMap;
    } catch (error) {
        console.error('Error fetching market values:', error);
        return {}; // Return empty on fail to gracefully fallback
    }
};

export const getPickEquivalent = (value) => {
    if (value >= 8000) return { label: 'Early 1st++', tier: 'High 1st', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    if (value >= 6000) return { label: 'Mid/Early 1st', tier: 'Mid 1st', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    if (value >= 5000) return { label: 'Late 1st', tier: 'Late 1st', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    if (value >= 3500) return { label: 'Early 2nd', tier: 'Early 2nd', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (value >= 2000) return { label: 'Mid 2nd', tier: 'Mid 2nd', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (value >= 1000) return { label: '3rd Rounder', tier: '3rd', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    return { label: 'Waiver', tier: 'Waiver', color: 'bg-slate-700/20 text-slate-400 border-slate-700/30' };
};
