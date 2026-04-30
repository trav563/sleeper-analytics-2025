import { Badge } from '../../../components/ui/Badge';
import { SectionCard } from '../../../components/ui/SectionCard';
import { cn } from '../../../lib/utils';

const URGENCY_STYLE = {
    critical: { row: 'bg-bad/15', count: 'text-bad', label: 'Need starter' },
    aging: { row: 'bg-warn/15', count: 'text-warn', label: 'Aging' },
    depth: { row: 'bg-signal/10', count: 'text-signal/80', label: 'Add depth' },
    good: { row: 'bg-good/10', count: 'text-good', label: '' },
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
 * Visual roster gap dashboard. Each row shows a position with owned/required
 * counts plus urgency badges (aging, depth). Color-coded by urgency.
 */
export default function TeamNeeds({ teamNeeds, hasRoster }) {
    if (!hasRoster) {
        return (
            <SectionCard title="Team Needs" eyebrow="Roster Analysis">
                <p className="text-sm text-text-mute">
                    No roster yet. Team needs will appear once you have players (e.g. a startup draft past round 1).
                </p>
            </SectionCard>
        );
    }

    if (!teamNeeds) {
        return (
            <SectionCard title="Team Needs" eyebrow="Roster Analysis">
                <p className="text-sm text-text-mute">Calculating…</p>
            </SectionCard>
        );
    }

    return (
        <SectionCard title="Team Needs" eyebrow="Roster Analysis">
            <div className="space-y-1.5">
                {teamNeeds.positions.map((row) => {
                    const style = URGENCY_STYLE[row.urgency];
                    return (
                        <div
                            key={row.pos}
                            className={cn(
                                'flex items-center justify-between py-1.5 px-2.5 rounded-md',
                                style.row
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className={cn('font-mono w-10 justify-center', POSITION_COLOR[row.pos])}
                                >
                                    {row.pos}
                                </Badge>
                                <span className="text-2xs text-text-mute uppercase tracking-wider">
                                    {style.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm tnum">
                                {row.agingCount > 0 && (
                                    <Badge variant="warning" className="text-2xs">
                                        {row.agingCount} aging
                                    </Badge>
                                )}
                                <span className={cn('font-semibold', style.count)}>
                                    {row.ownedCount}
                                    <span className="text-text-mute font-normal">/{row.required}</span>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}
