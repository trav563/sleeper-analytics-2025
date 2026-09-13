import { useCallback, useSyncExternalStore } from 'react';
import { probabilityHistoryKey, readProbabilityHistory, subscribeProbabilityHistory, emptyProbabilityHistory, probabilitySegments } from '../../../lib/winProbabilityHistory';

const timeLabel = at => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function WinProbabilityChart({ leagueId, season, week, matchupId, myRosterId, oppRosterId, winProb, myName, oppName, myHue, oppHue, canRecord = true, complete = false }) {
    const key = probabilityHistoryKey({ leagueId, season, week, matchupId, rosterIds: [myRosterId, oppRosterId] });
    const getSnapshot = useCallback(() => readProbabilityHistory(key), [key]);
    const stored = useSyncExternalStore(subscribeProbabilityHistory, getSnapshot, emptyProbabilityHistory);
    const points = stored.map(point => ({ ...point, p: Number(myRosterId) < Number(oppRosterId) ? point.p : 1 - point.p }));
    const first = points[0], last = points.at(-1);
    const start = first?.at || 0, span = last ? last.at - start : 0;
    const x = at => span ? 12 + (at - start) / span * 296 : 160;
    const y = p => 12 + (1 - p) * 100;
    const colors = [`oklch(72% 0.16 ${myHue})`, `oklch(72% 0.16 ${oppHue})`];
    const segments = probabilitySegments(points);
    const current = winProb ?? last?.p;
    return (
        <div>
            {points.length ? <>
                <svg viewBox="0 0 320 125" width="100%" height="150" role="img" aria-label={`Recorded win probability trend, ${points.length} ${points.length === 1 ? 'observation' : 'observations'}. Gaps indicate times not recorded.`}>
                    <line x1="12" x2="308" y1={y(.5)} y2={y(.5)} stroke="var(--line)" strokeDasharray="3 3" />
                    <text x="12" y="9" fontSize="9" fill="var(--text-mute)">100%</text>
                    {[false, true].map(opponent => <g key={String(opponent)}>
                        {segments.map((segment, i) => <g key={i}>
                            {segment.length > 1 && <path d={segment.map((p, j) => `${j ? 'L' : 'M'}${x(p.at)},${y(opponent ? 1 - p.p : p.p)}`).join(' ')} fill="none" stroke={colors[Number(opponent)]} strokeWidth="2" />}
                            {segment.map(p => <circle key={p.at} cx={x(p.at)} cy={y(opponent ? 1 - p.p : p.p)} r={p === last ? 3.5 : 2} fill={colors[Number(opponent)]}>
                                <title>{`${new Date(p.at).toLocaleString()}: ${Math.round((opponent ? 1 - p.p : p.p) * 100)}%`}</title>
                            </circle>)}
                        </g>)}
                    </g>)}
                </svg>
                <div className="flex justify-between text-xs font-mono text-text-mute gap-2">
                    <span>{timeLabel(first.at)}</span>
                    {span > 0 && <span>{timeLabel(last.at)}</span>}
                </div>
                <p className="text-xs text-text-mute mt-2">Recording began {new Date(first.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</p>
                {points.length === 1 && <p className="text-xs text-text-mute mt-2">{canRecord && !complete ? 'First observation saved. A line will appear after the next score refresh.' : 'Only one observation was recorded for this matchup.'}</p>}
            </> : <p className="text-sm text-text-mute">{canRecord && !complete ? 'No recorded history yet. Recording starts when fresh scores and game clocks are available.' : 'No history was recorded for this matchup in this browser.'}</p>}
            <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3 text-xs font-mono">
                {[myName, oppName].map((name, i) => <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="w-3 h-0.5 shrink-0" style={{ background: colors[i] }} />
                    <span className="truncate max-w-[150px] text-text">{name}</span>
                    <span className="text-text-dim">{current == null ? '—' : `${Math.round((i ? 1 - current : current) * 100)}%`}</span>
                </span>)}
            </div>
            {winProb == null && last && <p className="text-xs text-text-mute mt-2">Current estimate unavailable. Showing the last recorded probabilities.</p>}
            <p className="text-xs text-text-mute mt-3">Recorded while this league is open and visible. History is local to this browser; gaps are not backfilled.</p>
        </div>
    );
}
