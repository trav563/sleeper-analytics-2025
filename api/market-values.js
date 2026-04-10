const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

export default async function handler(req, res) {
    try {
        const numQbs = req.query.numQbs || 1;
        const numTeams = req.query.numTeams || 12;
        const ppr = req.query.ppr || 0.5;

        const url = `${FANTASY_CALC_API}?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'SleeperAnalytics/1.0' }
        });

        if (!response.ok) {
            throw new Error(`FantasyCalc API error: ${response.status}`);
        }

        const data = await response.json();

        // Map to { sleeperId: value }
        const valueMap = {};
        data.forEach(player => {
            if (player.sleeperId) {
                valueMap[player.sleeperId] = player.value;
            }
        });

        // Cache for 1 hour on Vercel CDN
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=60');
        res.status(200).json(valueMap);
    } catch (error) {
        console.error('Market values fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch market values' });
    }
}
