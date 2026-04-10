// Debug endpoint — returns the assembled prompt as JSON without calling Gemini.
// Use this to inspect exactly what data the AI receives.
// POST /api/analyze-debug with { leagueId, userId, week, analysisType }

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FANTASY_CALC_API = 'https://api.fantasycalc.com/values/current';

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} from ${url}`);
    return res.json();
}

function pName(p) {
    if (!p) return 'Unknown';
    return `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function getStatsPPG(stats, pprField) {
    if (!stats) return null;
    const gp = stats.gp || 0;
    const pts = stats[pprField] ?? stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std ?? 0;
    if (gp === 0) return null;
    return { pts, gp, ppg: (pts / gp).toFixed(1) };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { leagueId, userId, week = 1 } = req.body;
    if (!leagueId || !userId) return res.status(400).json({ error: 'Missing leagueId or userId' });

    try {
        const league = await fetchJSON(`${SLEEPER_BASE}/league/${leagueId}`);
        const settings = league.settings || {};
        const recPts = settings.rec ?? 0;
        const pprField = recPts >= 1 ? 'pts_ppr' : recPts >= 0.5 ? 'pts_half_ppr' : 'pts_std';
        const leagueSeason = league.season || '2025';
        const leaguePrevSeason = String(Number(leagueSeason) - 1);

        const [rosters, nflPlayers, currentStats, prevStats, weekProjections] = await Promise.all([
            fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/rosters`),
            fetchJSON(`${SLEEPER_BASE}/players/nfl`),
            fetchJSON(`${SLEEPER_BASE}/stats/nfl/regular/${leagueSeason}`).catch(() => ({})),
            fetchJSON(`${SLEEPER_BASE}/stats/nfl/regular/${leaguePrevSeason}`).catch(() => ({})),
            fetchJSON(`${SLEEPER_BASE}/projections/nfl/regular/${leagueSeason}/${week}`).catch(() => ({})),
        ]);

        const currentHasData = Object.keys(currentStats).length > 100;
        const [primaryStats, secondaryStats, primaryYear, secondaryYear] = currentHasData
            ? [currentStats, prevStats, leagueSeason, leaguePrevSeason]
            : [prevStats, currentStats, leaguePrevSeason, leagueSeason];

        const userRoster = rosters.find(r => r.owner_id === userId);
        if (!userRoster) return res.status(404).json({ error: 'Roster not found' });

        // Show stats for each player on the roster
        const rosterDebug = (userRoster.players || []).map(pid => {
            const p = nflPlayers[pid];
            if (!p) return { pid, error: 'Player not found in database' };
            const pri = getStatsPPG(primaryStats?.[pid], pprField);
            const sec = getStatsPPG(secondaryStats?.[pid], pprField);
            const proj = weekProjections?.[pid];
            const projPts = proj ? (proj[pprField] ?? proj.pts_ppr ?? 0) : 0;

            return {
                pid,
                name: pName(p),
                pos: p.position,
                team: p.team,
                injury: p.injury_status || 'Healthy',
                [`stats_${primaryYear}`]: pri ? `${pri.pts.toFixed(0)} pts, ${pri.gp} GP, ${pri.ppg} PPG` : 'No data',
                [`stats_${secondaryYear}`]: sec ? `${sec.pts.toFixed(0)} pts, ${sec.gp} GP, ${sec.ppg} PPG` : 'No data',
                weekProjection: projPts > 0 ? projPts.toFixed(1) : 'None',
                isStarter: (userRoster.starters || []).includes(pid),
            };
        });

        res.status(200).json({
            seasonDetection: {
                leagueSeason,
                leaguePrevSeason,
                currentStatsCount: Object.keys(currentStats).length,
                prevStatsCount: Object.keys(prevStats).length,
                currentHasData,
                primaryYear,
                secondaryYear,
                pprField,
            },
            roster: rosterDebug,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
