const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

/**
 * Parse a FantasyCalc pick name into a canonical map key.
 * Shapes in the payload (position === 'PICK'):
 *   "2026 Pick 1.01"    → PICK_2026_1_S1      (specific slot, upcoming draft)
 *   "2027 1st (Early)"  → PICK_2027_1_early   (future year, tiered)
 *   "2027 1st"          → PICK_2027_1         (future year, generic)
 */
export function pickKeyFromName(name) {
    let m = /^(\d{4}) Pick (\d+)\.(\d+)$/.exec(name);
    if (m) return `PICK_${m[1]}_${Number(m[2])}_S${Number(m[3])}`;
    m = /^(\d{4}) (\d+)(?:st|nd|rd|th) \((Early|Mid|Late)\)$/.exec(name);
    if (m) return `PICK_${m[1]}_${Number(m[2])}_${m[3].toLowerCase()}`;
    m = /^(\d{4}) (\d+)(?:st|nd|rd|th)$/.exec(name);
    if (m) return `PICK_${m[1]}_${Number(m[2])}`;
    return null;
}

/**
 * Fetch Dynasty Market Values from FantasyCalc.
 * Returns a map of sleeper player id -> value, plus canonical PICK_* keys for
 * the draft-pick entries in the same payload (0-10,000 approx scale).
 * @param {boolean} isSuperflex
 * @param {number} numTeams
 * @param {number} ppr
 * @returns {Promise<Object>}
 */
export const fetchMarketValues = async (isSuperflex = true, numTeams = 12, ppr = 0.5) => {
    try {
        const numQbs = isSuperflex ? 2 : 1;
        const url = `${FANTASY_CALC_API}?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch FantasyCalc values');

        const data = await response.json();

        const valueMap = {};
        data.forEach(entry => {
            // Entries nest the identity under `player`.
            const p = entry?.player;
            if (!p) return;
            if (p.position === 'PICK') {
                const key = pickKeyFromName(p.name);
                if (key) valueMap[key] = entry.value;
            } else if (p.sleeperId) {
                valueMap[p.sleeperId] = entry.value;
            }
        });

        return valueMap;
    } catch (error) {
        console.error('Error fetching market values:', error);
        // Second opinion: DynastyProcess weekly values (same scale + shape).
        try {
            const { fetchDynastyProcessValues } = await import('./dynastyProcess');
            const dp = await fetchDynastyProcessValues(isSuperflex);
            console.warn('FantasyCalc unavailable — using DynastyProcess values');
            return dp;
        } catch (dpError) {
            console.error('DynastyProcess fallback also failed:', dpError);
            return {}; // Empty map → consumers use their formula fallbacks
        }
    }
};

/**
 * Look up a draft pick's market value from a fetchMarketValues map.
 * Tries, in order: the exact slot (only exists for the upcoming draft year),
 * the year+round tier (early/mid/late), then the generic year+round.
 * @param {Object} valueMap  result of fetchMarketValues
 * @param {{year:number, round:number, rank?:number, tier?:'early'|'mid'|'late'}} pick
 * @returns {number|undefined}
 */
export const getMarketPickValue = (valueMap, { year, round, rank, tier }) => {
    if (!valueMap) return undefined;
    if (rank) {
        const slot = valueMap[`PICK_${year}_${round}_S${rank}`];
        if (slot != null) return slot;
    }
    if (tier) {
        const tiered = valueMap[`PICK_${year}_${round}_${tier}`];
        if (tiered != null) return tiered;
    }
    return valueMap[`PICK_${year}_${round}`];
};
