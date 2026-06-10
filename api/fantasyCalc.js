
export default async function handler(req, res) {
    const { isDynasty, numQbs, numTeams, ppr } = req.query;

    const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

    // Construct URL with query params
    const url = `${FANTASY_CALC_API}?isDynasty=${isDynasty}&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`FantasyCalc API responded with ${response.status}`);
        }

        const data = await response.json();

        // Cache Control: Cache for 1 hour (3600s)
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

        res.status(200).json(data);
    } catch (error) {
        console.error('FantasyCalc Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch market values' });
    }
}
