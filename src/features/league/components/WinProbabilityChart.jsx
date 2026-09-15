import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { probabilityHistoryKey, readProbabilityHistory, subscribeProbabilityHistory, emptyProbabilityHistory, probabilitySegments } from '../../../lib/winProbabilityHistory';

const timeLabel = at => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dateTimeLabel = at => new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const VIEW_W = 320, VIEW_H = 125;

export function WinProbabilityChart({ leagueId, season, week, matchupId, myRosterId, oppRosterId, winProb, myName, oppName, myHue, oppHue, canRecord = true, complete = false }) {
    const key = probabilityHistoryKey({ leagueId, season, week, matchupId, rosterIds: [myRosterId, oppRosterId] });
    const getSnapshot = useCallback(() => readProbabilityHistory(key), [key]);
    const stored = useSyncExternalStore(subscribeProbabilityHistory, getSnapshot, emptyProbabilityHistory);
    const svgRef = useRef(null);
    const [active, setActive] = useState(null);
    const points = stored.map(point => ({ ...point, p: Number(myRosterId) < Number(oppRosterId) ? point.p : 1 - point.p }));
    const first = points[0], last = points.at(-1);
    const start = first?.at || 0, span = last ? last.at - start : 0;
    const x = at => span ? 12 + (at - start) / span * 296 : 160;
    const y = p => 12 + (1 - p) * 100;
    const colors = [`oklch(72% 0.16 ${myHue})`, `oklch(72% 0.16 ${oppHue})`];
    const segments = probabilitySegments(points);
    const current = winProb ?? last?.p;
    const activePoint = active?.key === key ? points[active.index] : null;

    // Snap to the nearest recorded observation (hover on desktop, tap or drag on touch).
    const pick = event => {
        const svg = svgRef.current;
        const rect = svg?.getBoundingClientRect();
        if (!rect?.width || !points.length) return;
        const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
        const offset = (rect.width - VIEW_W * scale) / 2;
        const vx = (event.clientX - rect.left - offset) / scale;
        let index = 0;
        points.forEach((p, i) => { if (Math.abs(x(p.at) - vx) < Math.abs(x(points[index].at) - vx)) index = i; });
        const parentLeft = svg.parentElement.getBoundingClientRect().left;
        setActive({ key, index, left: rect.left - parentLeft + offset + x(points[index].at) * scale });
    };

    return (
        <div>
            {points.length ? <>
                <div className="relative">
                    <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="150" className="block touch-pan-y cursor-crosshair"
                        onPointerDown={pick} onPointerMove={pick} onPointerLeave={event => { if (event.pointerType === 'mouse') setActive(null); }}
                        role="img" aria-label={`Recorded win probability trend, ${points.length} ${points.length === 1 ? 'observation' : 'observations'}. Dashed lines span times not recorded.`}>
                        <line x1="12" x2="308" y1={y(.5)} y2={y(.5)} stroke="var(--line)" strokeDasharray="3 3" />
                        <text x="12" y="9" fontSize="9" fill="var(--text-mute)">100%</text>
                        {activePoint && <line x1={x(activePoint.at)} x2={x(activePoint.at)} y1="12" y2="112" stroke="var(--text-mute)" strokeOpacity=".5" />}
                        {[false, true].map(opponent => <g key={String(opponent)}>
                            {segments.slice(1).map((segment, i) => {
                                const from = segments[i].at(-1), to = segment[0];
                                return <line key={`gap-${to.at}`} data-gap="" x1={x(from.at)} y1={y(opponent ? 1 - from.p : from.p)} x2={x(to.at)} y2={y(opponent ? 1 - to.p : to.p)}
                                    stroke={colors[Number(opponent)]} strokeWidth="1.5" strokeDasharray="2 4" strokeOpacity=".5" />;
                            })}
                            {segments.map((segment, i) => <g key={i}>
                                {segment.length > 1 && <path d={segment.map((p, j) => `${j ? 'L' : 'M'}${x(p.at)},${y(opponent ? 1 - p.p : p.p)}`).join(' ')} fill="none" stroke={colors[Number(opponent)]} strokeWidth="2" />}
                                {segment.map(p => <circle key={p.at} cx={x(p.at)} cy={y(opponent ? 1 - p.p : p.p)} r={p === activePoint ? 4.5 : p === last ? 3.5 : 2}
                                    fill={colors[Number(opponent)]} stroke={p === activePoint ? 'var(--bg-1)' : 'none'} strokeWidth="1.5" />)}
                            </g>)}
                        </g>)}
                    </svg>
                    {activePoint && <div role="status" className="pointer-events-none absolute top-0 z-10 rounded-md border border-line bg-bg-2 px-2 py-1.5 text-xs font-mono tnum shadow-card whitespace-nowrap"
                        style={{ left: active.left, transform: x(activePoint.at) > VIEW_W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
                        <div className="text-text-mute">{dateTimeLabel(activePoint.at)}</div>
                        {[myName, oppName].map((name, i) => <div key={i} className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />
                            <span className="truncate max-w-[110px] text-text-dim">{name}</span>
                            <span className="ml-auto pl-2 text-text">{Math.round((i ? 1 - activePoint.p : activePoint.p) * 100)}%</span>
                        </div>)}
                    </div>}
                </div>
                <div className="flex justify-between text-xs font-mono text-text-mute gap-2">
                    <span>{timeLabel(first.at)}</span>
                    {span > 0 && <span>{timeLabel(last.at)}</span>}
                </div>
                <p className="text-xs text-text-mute mt-2">Recording began {dateTimeLabel(first.at)}.</p>
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
            <p className="text-xs text-text-mute mt-3">Recorded while this league is open and visible. History is local to this browser; gaps are not backfilled and appear as dashed lines.</p>
        </div>
    );
}
