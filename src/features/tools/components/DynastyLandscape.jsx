import { useMemo, useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Label } from 'recharts';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { activeRosterIds } from '../../../utils/leagueMath';
import { Switch } from '../../../components/ui/Switch';
import { fetchLeagueRosters } from '../../../utils/sleeper';
import { Globe } from 'lucide-react';
import { theme } from '../../../lib/theme';
import { useSleeper } from '../../../context/SleeperContext';

const TEAM_HUE = (rosterId) => `oklch(72% 0.16 ${(Number(rosterId || 0) * 47) % 360})`;

const SKILL_POS = new Set(['QB', 'RB', 'WR', 'TE']);
const MIN_GAMES = 4;
const MIN_SKILL_SAMPLE = 6;

function computeSeasonStats(seasonRoster, players, yearsAgo) {
    const s = seasonRoster?.settings || {};
    const games = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
    if (games < MIN_GAMES) return null;

    const fpts = (s.fpts || 0) + (s.fpts_decimal || 0) / 100;
    const ppts = (s.ppts || 0) + (s.ppts_decimal || 0) / 100;
    if (fpts <= 0) return null;

    const ids = seasonRoster.players || [];
    const skill = ids
        .map((id) => players[id])
        .filter((p) => p && SKILL_POS.has(p.position) && p.age);
    if (skill.length < MIN_SKILL_SAMPLE) return null;

    const avgAge =
        skill.reduce((sum, p) => sum + Math.max(20, p.age - yearsAgo), 0) / skill.length;

    return {
        avgAge: +avgAge.toFixed(1),
        ppg: +(fpts / games).toFixed(1),
        pptsPerGame: ppts > 0 ? +(ppts / games).toFixed(1) : null,
        games,
    };
}

const DynastyLandscape = ({ rosters, users, players, league, state }) => {
    const { leagueChains, user } = useSleeper();
    const [useMaxPf, setUseMaxPf] = useState(false);
    const [prevSeasonRosters, setPrevSeasonRosters] = useState(null);
    const [usingPrevSeason, setUsingPrevSeason] = useState(false);

    // Trail state — one (avgAge, PPG) point per (season, team) computed
    // synchronously from leagueChains. No extra fetches.
    const [showTrail, setShowTrail] = useState(false);
    const [selectedTrailRosterId, setSelectedTrailRosterId] = useState(null);

    // Find the chain that contains this league (for past-season rosters).
    const activeChain = useMemo(() => {
        if (!leagueChains || !league?.league_id) return null;
        for (const chain of Object.values(leagueChains)) {
            if (chain?.some((l) => l.league_id === league.league_id)) return chain;
        }
        return null;
    }, [leagueChains, league?.league_id]);

    const hasMultiSeasonHistory = (activeChain?.length || 0) > 1;

    // Default the trail picker to the logged-in user's team.
    useEffect(() => {
        if (selectedTrailRosterId || !rosters?.length) return;
        const mine = user ? rosters.find((r) => r.owner_id === user.user_id) : null;
        setSelectedTrailRosterId((mine || rosters[0])?.roster_id ?? null);
    }, [rosters, user, selectedTrailRosterId]);

    // Per-season aggregate trail. Each chain entry's roster already includes
    // settings.fpts/ppts/wins/losses/ties + players[] — no API fetches needed.
    // Production unit (PPG vs Max PF) tracks the snapshot's useMaxPf toggle.
    // Anchor season tracks what the snapshot is actually showing — when we
    // fall back to the previous league's data (in-progress current season
    // with no fpts yet), the snapshot represents that prior season, so the
    // trail should be anchored there too.
    const urlSeason = Number(league?.season) || Number(state?.season) || new Date().getFullYear();
    const anchorSeason = usingPrevSeason ? urlSeason - 1 : urlSeason;

    const trailByOwner = useMemo(() => {
        if (!activeChain || activeChain.length < 2 || !players) return null;
        const out = {};
        activeChain.forEach((entry) => {
            const season = Number(entry.season);
            // Skip the anchor + any future season; the snapshot append in
            // `selectedTrail` provides the anchor point. This prevents the
            // current in-progress NFL season from showing up at clamped
            // yearsAgo=0 with mid-season cumulative stats.
            if (!season || season >= anchorSeason) return;
            const yearsAgo = anchorSeason - season;

            Object.values(entry.rosters || {}).forEach((seasonRoster) => {
                const ownerId = seasonRoster?.owner_id;
                if (!ownerId) return;

                const stats = computeSeasonStats(seasonRoster, players, yearsAgo);
                if (!stats) return;

                // Trail always plots per-game so seasons of different lengths
                // are comparable. In Max PF mode, drop seasons where the old
                // league never populated `ppts` (pptsPerGame === null).
                const production = useMaxPf ? stats.pptsPerGame : stats.ppg;
                if (production == null) return;

                if (!out[ownerId]) out[ownerId] = [];
                out[ownerId].push({
                    season,
                    age: stats.avgAge,
                    production,
                    isTrail: true,
                });
            });
        });
        Object.keys(out).forEach((k) => out[k].sort((a, b) => a.season - b.season));
        return out;
    }, [activeChain, players, anchorSeason, useMaxPf]);

    const hasCurrentSeasonData = useMemo(() => {
        if (!rosters) return false;
        return rosters.some(r => (r.settings?.fpts || 0) > 0);
    }, [rosters]);

    useEffect(() => {
        if (hasCurrentSeasonData || !league?.previous_league_id) {
            setUsingPrevSeason(false);
            return;
        }
        let cancelled = false;
        fetchLeagueRosters(league.previous_league_id).then(data => {
            if (!cancelled && data) {
                setPrevSeasonRosters(data);
                setUsingPrevSeason(true);
            }
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [hasCurrentSeasonData, league?.previous_league_id]);

    const effectiveRosters = usingPrevSeason && prevSeasonRosters ? prevSeasonRosters : rosters;

    const data = useMemo(() => {
        if (!rosters || !users || !players || !league) return [];

        const currentLeg = state?.leg || 1;

        const teams = rosters.map(roster => {
            const owner = users.find(u => u.user_id === roster.owner_id);

            const ppgRoster = usingPrevSeason
                ? effectiveRosters?.find(r => r.owner_id === roster.owner_id) || roster
                : roster;

            let gamesPlayed;
            if (usingPrevSeason) {
                const totalRecord = (ppgRoster.settings?.wins || 0) + (ppgRoster.settings?.losses || 0) + (ppgRoster.settings?.ties || 0);
                gamesPlayed = Math.max(1, totalRecord > 18 ? totalRecord / 2 : totalRecord);
            } else {
                gamesPlayed = Math.max(1, currentLeg - 1);
            }

            const ppg = ((ppgRoster.settings?.fpts || 0) + (ppgRoster.settings?.fpts_decimal || 0) / 100) / gamesPlayed;
            const maxPf = (ppgRoster.settings?.ppts || 0) + (ppgRoster.settings?.ppts_decimal || 0) / 100;
            const productionMetric = useMaxPf ? maxPf : ppg;

            // Active roster only — taxi rookies and IR vets would skew the
            // contender/rebuild age signal.
            const validPlayers = activeRosterIds(roster)
                .map(id => players[id])
                .filter(p => p && ['QB', 'RB', 'WR', 'TE'].includes(p.position) && p.age);

            const totalAge = validPlayers.reduce((sum, p) => sum + (p.age || 0), 0);
            const avgAge = validPlayers.length > 0 ? totalAge / validPlayers.length : 0;

            return {
                rosterId: roster.roster_id,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar),
                age: parseFloat(avgAge.toFixed(1)),
                production: parseFloat(productionMetric.toFixed(1)),
                ppg: parseFloat(ppg.toFixed(1)),
                pptsPerGame: maxPf > 0 && gamesPlayed > 0
                    ? parseFloat((maxPf / gamesPlayed).toFixed(1))
                    : null,
                productionLabel: useMaxPf ? 'Max PF' : 'PPG',
            };
        });

        return teams.filter(t => t.age > 0);
    }, [rosters, users, players, league, state, useMaxPf, usingPrevSeason, effectiveRosters]);

    const averages = useMemo(() => {
        if (data.length === 0) return { age: 0, production: 0 };
        const totalAge = data.reduce((sum, t) => sum + t.age, 0);
        const totalProd = data.reduce((sum, t) => sum + t.production, 0);
        return {
            age: parseFloat((totalAge / data.length).toFixed(1)),
            production: parseFloat((totalProd / data.length).toFixed(1)),
        };
    }, [data]);

    // When Trail is on, the rendered Y is per-game — recompute the production
    // average against the per-game scale so the quadrant cross stays valid.
    const renderAverages = useMemo(() => {
        if (!showTrail || data.length === 0) return averages;
        const perGameProds = data.map((d) => useMaxPf ? (d.pptsPerGame ?? d.ppg) : d.ppg);
        const totalProd = perGameProds.reduce((sum, p) => sum + p, 0);
        return {
            age: averages.age,
            production: parseFloat((totalProd / perGameProds.length).toFixed(1)),
        };
    }, [showTrail, useMaxPf, data, averages]);

    const { bestId, worstId } = useMemo(() => {
        if (data.length === 0) return { bestId: null, worstId: null };

        const ages = data.map(d => d.age);
        const prods = data.map(d => d.production);
        const minAge = Math.min(...ages);
        const maxAge = Math.max(...ages);
        const minProd = Math.min(...prods);
        const maxProd = Math.max(...prods);
        const ageRange = maxAge - minAge || 1;
        const prodRange = maxProd - minProd || 1;

        let best = null, worst = null;
        let bestScore = -Infinity, worstScore = Infinity;

        data.forEach(team => {
            const normProd = (team.production - minProd) / prodRange;
            const normAge = (team.age - minAge) / ageRange;
            const score = (normProd * 0.6) + ((1 - normAge) * 0.4);

            if (score > bestScore) { bestScore = score; best = team.rosterId; }
            if (score < worstScore) { worstScore = score; worst = team.rosterId; }
        });

        return { bestId: best, worstId: worst };
    }, [data]);

    const enrichedData = useMemo(() => {
        return data.map(d => ({
            ...d,
            isBest: d.rosterId === bestId,
            isWorst: d.rosterId === worstId,
        }));
    }, [data, bestId, worstId]);

    // When the trail is shown, dim non-selected teams so the focus stays on the trail.
    const enrichedWithDim = useMemo(() => enrichedData.map((d) => ({
        ...d,
        dim: showTrail && selectedTrailRosterId && d.rosterId !== selectedTrailRosterId,
    })), [enrichedData, showTrail, selectedTrailRosterId]);

    // When Trail is on, swap snapshot production to per-game so it shares the
    // chart's Y scale with the trail dots (which are always per-game for
    // cross-season comparability). Trail off → unchanged behavior.
    const enrichedForRender = useMemo(() => enrichedWithDim.map((d) => {
        if (!showTrail) return d;
        const perGame = useMaxPf ? (d.pptsPerGame ?? d.ppg) : d.ppg;
        return {
            ...d,
            production: perGame,
            productionLabel: useMaxPf ? 'Max PPG' : 'PPG',
        };
    }), [enrichedWithDim, showTrail, useMaxPf]);

    // selectedTrailHistorical = trail entries whose season is NOT the anchor
    // (the anchor coincides with the selected team's bright snapshot avatar
    // — keeping both would render a small dot on top of the avatar).
    // Used as the data array for the unified Scatter so trail dots compete
    // with avatars in the same hit-test pool.

    const CustomNode = (props) => {
        const { cx, cy, payload } = props;
        // Shrink dimmed avatars so they don't visually swamp trail dots.
        const size = payload.dim ? 24 : (payload.isBest || payload.isWorst ? 48 : 40);
        const offset = size / 2;

        let borderStyle = {};
        if (payload.isBest) {
            borderStyle = { border: `3px solid ${theme.color.signal}`, boxShadow: `0 0 14px ${theme.color.signal}99` };
        } else if (payload.isWorst) {
            borderStyle = { border: `3px solid ${theme.color.bad}`, boxShadow: `0 0 14px ${theme.color.bad}99` };
        } else {
            borderStyle = { border: `2px solid ${theme.color.lineStrong}` };
        }

        const opacity = payload.dim ? 0.25 : 1;

        return (
            <foreignObject x={cx - offset} y={cy - offset} width={size} height={size}>
                <img
                    src={payload.avatar}
                    alt={payload.name}
                    style={{ width: size, height: size, borderRadius: '50%', ...borderStyle, cursor: 'pointer', background: theme.color.bg2, opacity }}
                    title={payload.name}
                />
            </foreignObject>
        );
    };

    const TrailDot = (props) => {
        const { cx, cy } = props;
        return (
            <g style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={5} fill={trailColor} fillOpacity={0.95} stroke={theme.color.bg} strokeWidth={1} />
            </g>
        );
    };

    // Dispatching shape so all hover-able points (snapshot avatars + trail
    // dots) live in a single Scatter. Recharts' nearest-point hit-test then
    // operates on one unified pool, so the trail dot you actually hover wins
    // instead of losing the tie-break to a separate-Scatter snapshot point.
    const UnifiedShape = (props) => (
        props.payload?.isTrail ? <TrailDot {...props} /> : <CustomNode {...props} />
    );

    const renderTrailTooltip = (d) => (
        <div className="bg-bg-1 border border-line p-3 rounded-md shadow-pop z-50">
            <p className="font-semibold text-text mb-1">
                {selectedTeamName} <span className="font-mono text-2xs text-text-mute">· {d.season}</span>
            </p>
            <div className="space-y-1 text-xs text-text-dim">
                <div className="flex justify-between gap-4">
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Avg Age</span>
                    <span className="font-mono tnum text-text">{d.age} yrs</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{useMaxPf ? 'Max PPG' : 'PPG'}</span>
                    <span className="font-mono font-bold tnum text-text">{d.production}</span>
                </div>
            </div>
        </div>
    );

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;

        // Trail-dot tooltip — show selected team + season + production.
        if (d.isTrail) return renderTrailTooltip(d);

        // Snapshot tooltip for the selected team (or any team when Trail is
        // off). Compare against renderAverages so the classification matches
        // the axis the user is currently looking at (per-game when Trail on).
        const avg = renderAverages;
        let classification = '';
        if (d.production >= avg.production && d.age <= avg.age) classification = 'Dynasty Elite';
        else if (d.production >= avg.production && d.age > avg.age) classification = 'Win-Now';
        else if (d.production < avg.production && d.age <= avg.age) classification = 'Rebuilder';
        else classification = 'Danger Zone';

        let highlight = '';
        if (d.isBest) highlight = 'Dynasty King';
        else if (d.isWorst) highlight = 'Cellar Dweller';

        return (
            <div className="bg-bg-1 border border-line p-3 rounded-md shadow-pop z-50">
                <p className="font-semibold text-text mb-1">{d.name}</p>
                <div className="space-y-1 text-xs text-text-dim">
                    <div className="flex justify-between gap-4">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Avg Age</span>
                        <span className="font-mono tnum text-text">{d.age} yrs</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{d.productionLabel}</span>
                        <span className={`font-mono font-bold tnum ${d.production >= avg.production ? 'text-good' : 'text-bad'}`}>
                            {d.production}
                        </span>
                    </div>
                    <div className="pt-2 mt-1 border-t border-line text-center font-mono text-2xs uppercase tracking-wider font-bold text-text">
                        {classification}
                    </div>
                    {highlight && (
                        <div className={`text-center font-bold font-mono text-2xs uppercase tracking-wider ${d.isBest ? 'text-signal' : 'text-bad'}`}>
                            {highlight}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Selected team's trail. Append the snapshot anchor at its per-game value
    // so the line tail lands on the bright current marker (which is now also
    // rendered per-game when Trail is on — see enrichedForRender).
    const selectedTrail = useMemo(() => {
        if (!showTrail || !trailByOwner || !selectedTrailRosterId || !enrichedData) return [];
        const r = rosters?.find((x) => x.roster_id === selectedTrailRosterId);
        const ownerId = r?.owner_id;
        if (!ownerId) return [];
        const baseTrail = trailByOwner[ownerId] || [];
        const currentSnapshot = enrichedData.find((d) => d.rosterId === selectedTrailRosterId);
        if (!currentSnapshot) return baseTrail;
        const anchorProduction = useMaxPf
            ? (currentSnapshot.pptsPerGame ?? currentSnapshot.ppg)
            : currentSnapshot.ppg;
        if (anchorProduction == null) return baseTrail;
        return [
            ...baseTrail.filter((p) => p.season !== anchorSeason),
            {
                season: anchorSeason,
                age: currentSnapshot.age,
                production: anchorProduction,
                isTrail: true,
            },
        ].sort((a, b) => a.season - b.season);
    }, [showTrail, trailByOwner, selectedTrailRosterId, rosters, enrichedData, anchorSeason, useMaxPf]);

    // Trail data without the anchor entry — used for the unified Scatter so
    // the bright snapshot avatar isn't covered by a small trail dot at the
    // same coordinate. The full `selectedTrail` (including anchor) is still
    // used by the line-only Scatter so the dashed line reaches the avatar.
    const trailHistorical = useMemo(
        () => selectedTrail.filter((p) => p.season !== anchorSeason),
        [selectedTrail, anchorSeason]
    );

    const combinedScatterData = useMemo(
        () => (showTrail ? [...enrichedForRender, ...trailHistorical] : enrichedForRender),
        [enrichedForRender, trailHistorical, showTrail]
    );

    const selectedTeamName = useMemo(() => {
        if (!selectedTrailRosterId) return '';
        const r = rosters?.find((x) => x.roster_id === selectedTrailRosterId);
        const u = users?.find((x) => x.user_id === r?.owner_id);
        return displayTeamName(u);
    }, [rosters, users, selectedTrailRosterId]);

    const trailColor = TEAM_HUE(selectedTrailRosterId);

    if (!enrichedData || enrichedData.length === 0) return null;

    // Display bounds — anchor on the snapshot (rendered values, which may be
    // per-game if Trail is on) so the cluster stays readable. Expand toward
    // trail data only within a soft cap so a single outlier season can't
    // squash the rest of the chart.
    const snapAges = enrichedForRender.map((d) => d.age);
    const snapProds = enrichedForRender.map((d) => d.production);
    const sAgeMin = Math.min(...snapAges);
    const sAgeMax = Math.max(...snapAges);
    const sPrdMin = Math.min(...snapProds);
    const sPrdMax = Math.max(...snapProds);
    const prdRange = Math.max(1, sPrdMax - sPrdMin);

    const trailAges = selectedTrail.map((d) => d.age);
    const trailProds = selectedTrail.map((d) => d.production);
    const ageCap = 2;                  // ±2 yrs absolute cap on age expansion
    const prdCap = prdRange * 0.5;     // ±50% of snapshot range cap on production

    const trailAgeLo = trailAges.length ? Math.min(...trailAges) : sAgeMin;
    const trailAgeHi = trailAges.length ? Math.max(...trailAges) : sAgeMax;
    const trailPrdLo = trailProds.length ? Math.min(...trailProds) : sPrdMin;
    const trailPrdHi = trailProds.length ? Math.max(...trailProds) : sPrdMax;

    const minAge = Math.floor(Math.max(sAgeMin - ageCap, Math.min(sAgeMin, trailAgeLo)) - 0.5);
    const maxAge = Math.ceil(Math.min(sAgeMax + ageCap, Math.max(sAgeMax, trailAgeHi)) + 0.5);
    const minProd = Math.floor(Math.max(sPrdMin - prdCap, Math.min(sPrdMin, trailPrdLo)) * 0.95);
    const maxProd = Math.ceil(Math.min(sPrdMax + prdCap, Math.max(sPrdMax, trailPrdHi)) * 1.05);

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="flex flex-row items-center justify-between gap-3 p-4 border-b border-line">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-signal" aria-hidden="true" />
                        Tool · Dynasty Landscape
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-text">
                        Competitive Window
                    </h3>
                    <p className="text-xs text-text-dim mt-0.5">
                        Age vs Production
                        {usingPrevSeason && <span className="text-warn ml-1">— using <span className="tnum">{parseInt(state?.season || '2026') - 1}</span> season data</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    {showTrail && hasMultiSeasonHistory && (
                        <select
                            value={selectedTrailRosterId || ''}
                            onChange={(e) => setSelectedTrailRosterId(Number(e.target.value))}
                            className="bg-bg-2 border border-line text-text text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-signal max-w-[160px]"
                            aria-label="Trail team"
                        >
                            {rosters?.map((r) => {
                                const u = users?.find((u) => u.user_id === r.owner_id);
                                return (
                                    <option key={r.roster_id} value={r.roster_id}>
                                        {displayTeamName(u)}
                                    </option>
                                );
                            })}
                        </select>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`font-mono text-2xs uppercase tracking-wider ${hasMultiSeasonHistory ? 'text-text-mute' : 'text-text-mute/40'}`}
                            title={hasMultiSeasonHistory ? '' : 'Trend trail unlocks after one full season of league history'}
                        >
                            Trail
                        </span>
                        <Switch
                            checked={showTrail}
                            onCheckedChange={setShowTrail}
                            disabled={!hasMultiSeasonHistory}
                            className="scale-75 sm:scale-90"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{useMaxPf ? 'Max PF' : 'PPG'}</span>
                        <Switch checked={useMaxPf} onCheckedChange={setUseMaxPf} className="scale-75 sm:scale-100" />
                    </div>
                </div>
            </header>

            <div className="p-2 sm:p-5 sm:pt-3">
                <div
                    className="h-[480px] w-full text-xs"
                    role="img"
                    aria-label="Scatter chart of every team's average roster age (horizontal axis) against production (vertical axis), split into contender and rebuild quadrants. The Dynasty Window table above lists the same teams with scores as text."
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme.color.lineStrong} opacity={0.4} />

                            <ReferenceArea x1={minAge} x2={renderAverages.age} y1={renderAverages.production} y2={maxProd} fill={theme.color.good} fillOpacity={0.05} />
                            <ReferenceArea x1={renderAverages.age} x2={maxAge} y1={renderAverages.production} y2={maxProd} fill={theme.color.signal} fillOpacity={0.05} />
                            <ReferenceArea x1={minAge} x2={renderAverages.age} y1={minProd} y2={renderAverages.production} fill={theme.color.signal2} fillOpacity={0.05} />
                            <ReferenceArea x1={renderAverages.age} x2={maxAge} y1={minProd} y2={renderAverages.production} fill={theme.color.bad} fillOpacity={0.05} />

                            <XAxis
                                type="number"
                                dataKey="age"
                                name="Average Age"
                                allowDataOverflow={true}
                                domain={[minAge, maxAge]}
                                stroke={theme.color.textDim}
                                tick={{ fill: theme.color.textDim, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                                tickCount={5}
                            >
                                <Label value="Average Age" offset={-10} position="insideBottom" fill={theme.color.textMute} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }} />
                            </XAxis>

                            <YAxis
                                type="number"
                                dataKey="production"
                                name="Production"
                                allowDataOverflow={true}
                                domain={[minProd, maxProd]}
                                stroke={theme.color.textDim}
                                tick={{ fill: theme.color.textDim, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                                width={36}
                            >
                                <Label
                                    value={showTrail && useMaxPf ? 'Max PPG' : (useMaxPf ? 'Max PF' : 'PPG')}
                                    angle={-90}
                                    position="insideLeft"
                                    offset={14}
                                    fill={theme.color.textMute}
                                    style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                />
                            </YAxis>

                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.color.lineStrong, strokeDasharray: '3 3' }} />

                            <ReferenceLine x={renderAverages.age} stroke={theme.color.textDim} strokeDasharray="3 3" />
                            <ReferenceLine y={renderAverages.production} stroke={theme.color.textDim} strokeDasharray="3 3" />

                            {/* Unified Scatter: snapshot avatars + trail dots in one hit-test pool */}
                            <Scatter name="Teams" data={combinedScatterData} shape={<UnifiedShape />} />
                            {/* Line-only Scatter: invisible shape, just provides the dashed trail line */}
                            {showTrail && selectedTrail.length > 1 && (
                                <Scatter
                                    name="TrailLine"
                                    data={selectedTrail}
                                    shape={() => null}
                                    line={{ stroke: trailColor, strokeOpacity: 0.5, strokeDasharray: '4 4', strokeWidth: 1.5 }}
                                    legendType="none"
                                    isAnimationActive={false}
                                />
                            )}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {showTrail && (
                    <div className="mt-2 px-2 sm:px-0 font-mono text-2xs uppercase tracking-wider">
                        {selectedTrail.length === 0 ? (
                            <span className="text-warn">
                                No completed seasons found in this league's history.
                            </span>
                        ) : (
                            <span className="text-text-dim">
                                Trail · <span className="text-text">{selectedTeamName}</span>{useMaxPf && <span className="text-text-mute"> · per-game scale</span>} · <span className="tnum">{selectedTrail.length}</span> {selectedTrail.length === 1 ? 'season' : 'seasons'} (oldest → current)
                            </span>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4 px-2 pb-2 sm:px-0 sm:pb-0">
                    {[
                        { label: 'Dynasty Elite', color: theme.color.good },
                        { label: 'Win-Now', color: theme.color.signal },
                        { label: 'Rebuilder', color: theme.color.signal2 },
                        { label: 'Danger Zone', color: theme.color.bad },
                    ].map(({ label, color }) => (
                        <div key={label} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: `${color}33`, border: `1px solid ${color}` }} />
                            <span className="font-mono text-2xs uppercase tracking-wider text-text-dim">{label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: `${theme.color.signal}66`, border: `2px solid ${theme.color.signal}`, boxShadow: `0 0 6px ${theme.color.signal}80` }} />
                        <span className="font-mono text-2xs uppercase tracking-wider text-signal">Dynasty King</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: `${theme.color.bad}66`, border: `2px solid ${theme.color.bad}`, boxShadow: `0 0 6px ${theme.color.bad}80` }} />
                        <span className="font-mono text-2xs uppercase tracking-wider text-bad">Cellar Dweller</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DynastyLandscape;
