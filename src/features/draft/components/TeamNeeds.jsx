import { Badge } from '../../../components/ui/Badge';
import { SectionCard } from '../../../components/ui/SectionCard';
import { cn } from '../../../lib/utils';

const URGENCY_STYLE = {
    critical: { row: 'bg-bad/15 border-bad/30', label: 'Critical', text: 'text-bad', bar: 'bg-bad' },
    below: { row: 'bg-warn/15 border-warn/30', label: 'Below avg', text: 'text-warn', bar: 'bg-warn' },
    average: { row: 'bg-bg-2 border-line', label: 'Average', text: 'text-text', bar: 'bg-text-mute' },
    strong: { row: 'bg-good/15 border-good/30', label: 'Strong', text: 'text-good', bar: 'bg-good' },
    unknown: { row: 'bg-bg-2 border-line', label: '—', text: 'text-text-mute', bar: 'bg-text-mute' },
};

const POSITION_COLOR = {
    QB: 'bg-bad/15 text-bad border-bad/30',
    RB: 'bg-good/15 text-good border-good/30',
    WR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    TE: 'bg-signal/15 text-signal/80 border-signal/30',
    K: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    DEF: 'bg-bg-3 text-text-dim border-line',
};

/**
 * Quality-vs-league rendering. Each row shows a position with the user's
 * rank in the league plus an urgency band and a percentile bar so the
 * relative-to-field signal is obvious at a glance.
 */
export default function TeamNeeds({ teamNeeds, hasRoster }) {
    if (!hasRoster) {
        return (
            <SectionCard title="Team Needs" eyebrow="Roster Strength">
                <p className="text-sm text-text-mute">
                    No roster yet. Strength comparisons appear once you have players to evaluate.
                </p>
            </SectionCard>
        );
    }

    if (!teamNeeds) {
        return (
            <SectionCard title="Team Needs" eyebrow="Roster Strength">
                <p className="text-sm text-text-mute">Calculating…</p>
            </SectionCard>
        );
    }

    return (
        <SectionCard title="Team Needs" eyebrow="Roster Strength">
            <div className="space-y-1.5">
                {teamNeeds.positions.map((row) => {
                    const style = URGENCY_STYLE[row.urgency];
                    const pctWidth = Math.max(4, Math.round((row.percentile || 0) * 100));
                    const showDelta = row.valueVsMedian !== 0 && row.userStrength > 0;
                    return (
                        <div
                            key={row.pos}
                            className={cn(
                                'flex items-center justify-between gap-3 p-2.5 rounded-md border',
                                style.row
                            )}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Badge
                                    variant="outline"
                                    className={cn('font-mono w-10 justify-center shrink-0', POSITION_COLOR[row.pos])}
                                >
                                    {row.pos}
                                </Badge>
                                <div className="min-w-0">
                                    <div className={cn('text-sm font-semibold leading-tight', style.text)}>
                                        {style.label}
                                    </div>
                                    <div className="text-2xs text-text-mute font-mono mt-0.5">
                                        #{row.rank} of {row.leagueSize}
                                        {showDelta && (
                                            <span
                                                className={cn(
                                                    'ml-1.5',
                                                    row.valueVsMedian < 0 ? 'text-bad' : 'text-good'
                                                )}
                                            >
                                                {row.valueVsMedian > 0 ? '+' : ''}
                                                {Math.round(row.valueVsMedian)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* Percentile bar */}
                            <div
                                className="w-16 h-1.5 bg-bg-3 rounded-full overflow-hidden shrink-0"
                                title={`${Math.round((row.percentile || 0) * 100)}th percentile`}
                            >
                                <div
                                    className={cn('h-full transition-all', style.bar)}
                                    style={{ width: `${pctWidth}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-2xs text-text-mute mt-3 leading-snug">
                Compares your top starters' FantasyCalc value to the rest of your league. Top 25% = strong · Bottom 25% = critical.
            </p>
        </SectionCard>
    );
}
