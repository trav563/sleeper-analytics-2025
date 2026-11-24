import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target } from 'lucide-react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { SectionCard } from '../../../components/ui/SectionCard';
import { StatCell } from '../../../components/ui/StatCell';
import { summarizePerfectWeeks } from '../../../utils/perfectWeeks';

const score = n => n.toFixed(2);
const whole = n => n.toLocaleString();

const Avatar = ({ avatar, name, size = 32 }) =>
    avatar ? (
        <img src={avatarUrl(avatar)} alt="" style={{ width: size, height: size }} className="rounded-full ring-1 ring-line shrink-0" />
    ) : (
        <Pip seed={name} name={name} size={size} />
    );

const SubHeading = ({ children }) => (
    <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-3">{children}</h3>
);

/** Counts per season. One series, so no legend; the axis carries the values. */
const SeasonChart = ({ rows }) => {
    const peak = Math.max(1, ...rows.map(r => r.perfect));
    return (
        <div className="h-[180px] w-full" role="img" aria-label={`Perfect weeks by season: ${rows.map(r => `${r.season}, ${r.perfect}`).join('; ')}`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis
                        dataKey="season"
                        tickLine={false}
                        axisLine={{ stroke: 'var(--line-strong)' }}
                        tick={{ fill: 'var(--text-mute)', fontSize: 11 }}
                    />
                    <YAxis
                        allowDecimals={false}
                        domain={[0, peak]}
                        tickCount={peak + 1}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        tick={{ fill: 'var(--text-mute)', fontSize: 11 }}
                    />
                    <Tooltip
                        cursor={{ fill: 'var(--bg-2)' }}
                        contentStyle={{
                            background: 'var(--bg-2)', border: '1px solid var(--line-strong)',
                            borderRadius: 8, fontSize: 12, color: 'var(--text)',
                        }}
                        labelStyle={{ color: 'var(--text-dim)' }}
                        formatter={(value, _n, item) => [
                            `${value} of ${whole(item.payload.teamWeeks)} team-weeks · ${item.payload.weeks} weeks played`,
                            'Perfect',
                        ]}
                    />
                    <Bar dataKey="perfect" fill="var(--signal)" maxBarSize={24} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

/** One manager: how many, a bar for the ranking, and every week behind it. */
const ManagerRow = ({ holder, peak }) => (
    <li className="py-3 border-b border-line last:border-0">
        <div className="flex items-center gap-3">
            <Avatar avatar={holder.avatar} name={holder.name} />
            <div className="min-w-0 flex-1">
                <div className="text-sm text-text truncate" title={holder.name}>{holder.name}</div>
                <div className="h-2 mt-1.5 rounded-full bg-bg-3 overflow-hidden">
                    <div className="h-full rounded-full bg-signal" style={{ width: `${(holder.count / peak) * 100}%` }} />
                </div>
            </div>
            <div className="tnum font-display text-xl font-bold text-text shrink-0 w-6 text-right">{holder.count}</div>
        </div>
        <ul className="mt-2 ml-11 space-y-1">
            {holder.weeks.map(w => (
                <li key={`${w.season}-${w.week}`} className="font-mono text-2xs text-text-dim flex flex-wrap gap-x-2">
                    <span className="tnum text-text">{w.season} W{w.week}</span>
                    <span className="tnum">{score(w.actual)}</span>
                    {w.benchBest && (
                        <span className="text-text-mute">
                            best bench {w.benchBest.name}
                            {w.benchBest.position ? ` (${w.benchBest.position})` : ''} <span className="tnum">{score(w.benchBest.points)}</span>
                        </span>
                    )}
                </li>
            ))}
        </ul>
    </li>
);

/** The weeks that came closest without getting there. */
const NearMissRow = ({ miss }) => (
    <li className="flex items-start gap-3 py-2.5 border-b border-line last:border-0">
        <span className="tnum font-mono text-sm text-signal-2 shrink-0 w-12">−{score(miss.gap)}</span>
        <div className="min-w-0 flex-1">
            <div className="text-xs text-text truncate">
                <span className="tnum font-mono text-text-dim">{miss.season} W{miss.week}</span>{' '}{miss.name}
            </div>
            {miss.swapIn && miss.swapOut && (
                <div className="font-mono text-2xs text-text-mute mt-0.5">
                    {miss.swapIn.name} <span className="tnum">{score(miss.swapIn.points)}</span> in for {miss.swapOut.name} <span className="tnum">{score(miss.swapOut.points)}</span>
                </div>
            )}
        </div>
        <span className="tnum font-mono text-2xs text-text-dim shrink-0 mt-0.5">
            {score(miss.actual)} / {score(miss.optimal)}
        </span>
    </li>
);

const PerfectWeeksPanel = ({ leagueHistory, historicalMatchups, users, players }) => {
    const summary = useMemo(() => {
        if (!leagueHistory?.length || !players || !Object.keys(historicalMatchups || {}).length) return null;

        const seasons = leagueHistory
            .map(league => {
                const entry = historicalMatchups[league.league_id];
                if (!entry) return null;
                const seasonUsers = entry.users || [];
                // Prefer current-league users (freshest names); fall back to that
                // season's users so departed managers still resolve.
                const findUser = ownerId =>
                    users?.find(u => u.user_id === ownerId) || seasonUsers.find(u => u.user_id === ownerId);
                return {
                    season: league.season,
                    slots: league.roster_positions,
                    playoffWeekStart: league.playoff_week_start,
                    weeks: entry.weeks,
                    resolveTeam: rosterId => {
                        const roster = Object.values(league.rosters || {}).find(r => r.roster_id === rosterId);
                        const user = findUser(roster?.owner_id);
                        return { key: roster?.owner_id || `roster-${rosterId}`, name: displayTeamName(user), avatar: user?.avatar };
                    },
                };
            })
            .filter(Boolean);

        return summarizePerfectWeeks(seasons, players);
    }, [leagueHistory, historicalMatchups, users, players]);

    if (!summary) return null;
    const peak = Math.max(1, ...summary.byManager.map(h => h.count));

    return (
        <SectionCard
            eyebrow="Flawless lineups"
            title="Perfect Weeks"
            action={<Target className="w-5 h-5 text-signal" aria-hidden="true" />}
        >
            <p className="text-xs text-text-dim mb-4 max-w-prose">
                Weeks where the lineup already held every point the roster had — no swap would have scored more.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <StatCell label="All-time" value={summary.total} tone="signal" />
                <StatCell label="Hit rate" value={`${(summary.rate * 100).toFixed(1)}%`} />
                <StatCell label="One every" value={summary.oneIn ?? '—'} />
                <StatCell label="Team-weeks" value={whole(summary.teamWeeks)} />
            </div>
            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-2">
                <span className="tnum">{summary.regularSeason}</span> regular season
                <span className="mx-1.5">·</span>
                <span className="tnum">{summary.postseason}</span> postseason
            </p>

            {summary.total > 0 ? (
                <>
                    <div className="mt-6">
                        <SubHeading>By season</SubHeading>
                        <SeasonChart rows={summary.bySeason} />
                    </div>

                    <div className="mt-6">
                        <SubHeading>By manager</SubHeading>
                        <ul>
                            {summary.byManager.map(holder => (
                                <ManagerRow key={holder.key} holder={holder} peak={peak} />
                            ))}
                        </ul>
                    </div>
                </>
            ) : (
                <div className="text-center text-text-mute py-6 text-sm">
                    Nobody has started a flawless lineup yet.
                </div>
            )}

            {summary.nearMisses.length > 0 && (
                <div className="mt-6">
                    <SubHeading>Closest misses</SubHeading>
                    <ul>
                        {summary.nearMisses.map(miss => (
                            <NearMissRow key={`${miss.season}-${miss.week}-${miss.key}`} miss={miss} />
                        ))}
                    </ul>
                </div>
            )}

            <p className="text-2xs text-text-mute leading-relaxed mt-5 pt-3 border-t border-line">
                Counts are a floor. A player who was on IR or added after lineups locked still sits in
                the week&rsquo;s roster data, which can make the best possible lineup look higher than it
                really was — that hides a perfect week, it never invents one.
            </p>
        </SectionCard>
    );
};

export default PerfectWeeksPanel;
