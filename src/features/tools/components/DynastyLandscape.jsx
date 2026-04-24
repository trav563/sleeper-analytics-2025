import { useMemo, useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Label } from 'recharts';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Switch } from '../../../components/ui/Switch';
import { fetchLeagueRosters } from '../../../utils/sleeper';
import { Globe } from 'lucide-react';
import { theme } from '../../../lib/theme';
import { useSleeper } from '../../../context/SleeperContext';

const TEAM_HUE = (rosterId) => `oklch(72% 0.16 ${(Number(rosterId || 0) * 47) % 360})`;

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
    // Anchor season is the URL's league.season (so when viewing the 2025
    // league, the snapshot represents 2025, not the live NFL year).
    const anchorSeason = Number(league?.season) || Number(state?.season) || new Date().getFullYear();

    const trailByOwner = useMemo(() => {
        if (!activeChain || activeChain.length < 2 || !players) return null;
        const out = {};
        activeChain.forEach((entry) => {
            const yearsAgo = Math.max(0, anchorSeason - Number(entry.season));
            Object.values(entry.rosters || {}).forEach((seasonRoster) => {
                const ownerId = seasonRoster?.owner_id;
                if (!ownerId) return;

                const settings = seasonRoster.settings || {};
                const wins = settings.wins || 0;
                const losses = settings.losses || 0;
                const ties = settings.ties || 0;
                const games = wins + losses + ties;
                if (games === 0) return; // skip preseason / no completed games

                const fpts = (settings.fpts || 0) + ((settings.fpts_decimal || 0) / 100);
                const ppts = (settings.ppts || 0) + ((settings.ppts_decimal || 0) / 100);
                const ppg = fpts / games;
                const production = parseFloat((useMaxPf ? ppts : ppg).toFixed(1));

                const skillAges = (seasonRoster.players || [])
                    .map((pid) => players[pid])
                    .filter((p) => p && ['QB', 'RB', 'WR', 'TE'].includes(p.position) && p.age)
                    .map((p) => Math.max(20, p.age - yearsAgo));
                if (skillAges.length === 0) return;
                const avgAge = parseFloat(
                    (skillAges.reduce((s, a) => s + a, 0) / skillAges.length).toFixed(1)
                );

                if (!out[ownerId]) out[ownerId] = [];
                out[ownerId].push({
                    season: Number(entry.season),
                    age: avgAge,
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

            const validPlayers = (roster.players || [])
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

    const CustomNode = (props) => {
        const { cx, cy, payload } = props;
        const size = payload.isBest || payload.isWorst ? 48 : 40;
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
        // Visible 3px dot + invisible 14-radius hit area so Recharts can pick
        // the trail dot's payload over a nearby snapshot avatar (40px wide).
        return (
            <g>
                <circle cx={cx} cy={cy} r={14} fill="transparent" />
                <circle cx={cx} cy={cy} r={3} fill={trailColor} fillOpacity={0.7} />
            </g>
        );
    };

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null;
        const d = payload[0].payload;

        // Trail-dot tooltip — show selected team + season + production.
        if (d.isTrail) {
            return (
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
                            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{useMaxPf ? 'Max PF' : 'PPG'}</span>
                            <span className="font-mono font-bold tnum text-text">{d.production}</span>
                        </div>
                    </div>
                </div>
            );
        }

        // When trail is on, only the SELECTED team's snapshot produces a
        // tooltip. Hovering other (dimmed) avatars stays silent so trail
        // focus is preserved and we never label the wrong team.
        if (showTrail && d.rosterId !== selectedTrailRosterId) return null;

        let classification = '';
        if (d.production >= averages.production && d.age <= averages.age) classification = 'Dynasty Elite';
        else if (d.production >= averages.production && d.age > averages.age) classification = 'Win-Now';
        else if (d.production < averages.production && d.age <= averages.age) classification = 'Rebuilder';
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
                        <span className={`font-mono font-bold tnum ${d.production >= averages.production ? 'text-good' : 'text-bad'}`}>
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

    // Selected team's trail. Replace the chain's anchor-season entry with the
    // snapshot's exact (age, production) so the line tail lands on the bright
    // current marker. We do NOT filter by snapshot bounds — showing all of
    // the team's chain seasons is the whole point, even if PPG/age diverged.
    const selectedTrail = useMemo(() => {
        if (!showTrail || !trailByOwner || !selectedTrailRosterId || !enrichedData) return [];
        const r = rosters?.find((x) => x.roster_id === selectedTrailRosterId);
        const ownerId = r?.owner_id;
        if (!ownerId) return [];
        const baseTrail = trailByOwner[ownerId] || [];
        const currentSnapshot = enrichedData.find((d) => d.rosterId === selectedTrailRosterId);
        if (!currentSnapshot) return baseTrail;
        return [
            ...baseTrail.filter((p) => p.season !== anchorSeason),
            {
                season: anchorSeason,
                age: currentSnapshot.age,
                production: currentSnapshot.production,
                isTrail: true,
            },
        ].sort((a, b) => a.season - b.season);
    }, [showTrail, trailByOwner, selectedTrailRosterId, rosters, enrichedData, anchorSeason]);

    const selectedTeamName = useMemo(() => {
        if (!selectedTrailRosterId) return '';
        const r = rosters?.find((x) => x.roster_id === selectedTrailRosterId);
        const u = users?.find((x) => x.user_id === r?.owner_id);
        return displayTeamName(u);
    }, [rosters, users, selectedTrailRosterId]);

    const trailColor = TEAM_HUE(selectedTrailRosterId);

    if (!enrichedData || enrichedData.length === 0) return null;

    // Display bounds — include both snapshot AND selected trail so every dot
    // is visible. Reference lines stay at snapshot averages (still meaningful
    // as "league baseline") even when the chart range expands.
    const ages = [...enrichedData.map(d => d.age), ...selectedTrail.map(d => d.age)];
    const prods = [...enrichedData.map(d => d.production), ...selectedTrail.map(d => d.production)];
    const minAge = Math.floor(Math.min(...ages) - 0.5);
    const maxAge = Math.ceil(Math.max(...ages) + 0.5);
    const minProd = Math.floor(Math.min(...prods) * 0.95);
    const maxProd = Math.ceil(Math.max(...prods) * 1.05);

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
                <div className="h-[480px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme.color.lineStrong} opacity={0.4} />

                            <ReferenceArea x1={minAge} x2={averages.age} y1={averages.production} y2={maxProd} fill={theme.color.good} fillOpacity={0.05} />
                            <ReferenceArea x1={averages.age} x2={maxAge} y1={averages.production} y2={maxProd} fill={theme.color.signal} fillOpacity={0.05} />
                            <ReferenceArea x1={minAge} x2={averages.age} y1={minProd} y2={averages.production} fill={theme.color.signal2} fillOpacity={0.05} />
                            <ReferenceArea x1={averages.age} x2={maxAge} y1={minProd} y2={averages.production} fill={theme.color.bad} fillOpacity={0.05} />

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
                                width={32}
                            />

                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.color.lineStrong, strokeDasharray: '3 3' }} />

                            <ReferenceLine x={averages.age} stroke={theme.color.textDim} strokeDasharray="3 3" />
                            <ReferenceLine y={averages.production} stroke={theme.color.textDim} strokeDasharray="3 3" />

                            <Scatter name="Teams" data={enrichedWithDim} shape={<CustomNode />} />
                            {showTrail && selectedTrail.length > 0 && (
                                <Scatter
                                    name="Trail"
                                    data={selectedTrail}
                                    shape={<TrailDot />}
                                    line={selectedTrail.length > 1
                                        ? { stroke: trailColor, strokeOpacity: 0.5, strokeDasharray: '4 4', strokeWidth: 1.5 }
                                        : false}
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
                                Trail · <span className="text-text">{selectedTeamName}</span> · <span className="tnum">{selectedTrail.length}</span> {selectedTrail.length === 1 ? 'season' : 'seasons'} (oldest → current)
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
