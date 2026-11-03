import { useRef, useState } from 'react';
import { layoutProbabilityWindows } from '../../../lib/winProbabilityHistory';

const dateTimeLabel = at => new Date(at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayLabel = at => new Date(at).toLocaleDateString([], { weekday: 'short' }).toUpperCase();
const VIEW_W = 320, VIEW_H = 125;
const MIN_LABEL_WIDTH = 16; // Narrower windows can't fit a day label without colliding.

export function WinProbabilityChart({ points: series = [], myRosterId, oppRosterId, winProb, myName, oppName, myHue, oppHue, canRecord = true, complete = false, loading = false, unavailable = false }) {
    const svgRef = useRef(null);
    const [active, setActive] = useState(null);
    // Samples are stored for the lower roster id; flip them for the other perspective.
    const oriented = series.map(point => ({ ...point, p: Number(myRosterId) < Number(oppRosterId) ? point.p : 1 - point.p }));
    const windows = layoutProbabilityWindows(oriented);
    const points = windows.flatMap(window => window.points);
    const first = points[0], last = points.at(-1);
    const seriesKey = `${first?.at}:${myRosterId}:${oppRosterId}`;
    const y = p => 12 + (1 - p) * 100;
    const colors = [`oklch(72% 0.16 ${myHue})`, `oklch(72% 0.16 ${oppHue})`];
    const current = winProb ?? last?.p;
    const activePoint = active?.key === seriesKey ? points[active.index] : null;

    // Snap to the nearest recorded observation (hover on desktop, tap or drag on touch).
    const pick = event => {
        const svg = svgRef.current;
        const rect = svg?.getBoundingClientRect();
        if (!rect?.width || !points.length) return;
        const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
        const offset = (rect.width - VIEW_W * scale) / 2;
        const vx = (event.clientX - rect.left - offset) / scale;
        let index = 0;
        points.forEach((p, i) => { if (Math.abs(p.x - vx) < Math.abs(points[index].x - vx)) index = i; });
        const parentLeft = svg.parentElement.getBoundingClientRect().left;
        setActive({ key: seriesKey, index, left: rect.left - parentLeft + offset + points[index].x * scale });
    };

    const emptyMessage = loading ? 'Loading history…'
        : unavailable ? 'History is temporarily unavailable.'
            : canRecord && !complete ? 'No samples yet. Tracking starts with the next game after this league is first opened.'
                : 'No history was recorded for this matchup.';

    return (
        <div>
            {points.length ? <>
                <div className="relative">
                    <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="150" className="block touch-pan-y cursor-crosshair"
                        onPointerDown={pick} onPointerMove={pick} onPointerLeave={event => { if (event.pointerType === 'mouse') setActive(null); }}
                        role="img" aria-label={`Win probability trend, ${points.length} ${points.length === 1 ? 'sample' : 'samples'} across ${windows.length} game ${windows.length === 1 ? 'window' : 'windows'}. Dashed lines span samples that were missed.`}>
                        <line x1="12" x2="308" y1={y(.5)} y2={y(.5)} stroke="var(--line)" strokeDasharray="3 3" />
                        <text x="12" y="9" fontSize="9" fill="var(--text-mute)">100%</text>
                        {windows.map((window, i) => <g key={window.start}>
                            {i > 0 && <line data-window-break="" x1={window.x0 - 5} x2={window.x0 - 5} y1="12" y2="112" stroke="var(--line)" />}
                            {window.x1 - window.x0 >= MIN_LABEL_WIDTH && <text x={(window.x0 + window.x1) / 2} y="123" fontSize="8" textAnchor="middle" className="font-mono" fill="var(--text-mute)">{dayLabel(window.start)}</text>}
                        </g>)}
                        {activePoint && <line x1={activePoint.x} x2={activePoint.x} y1="12" y2="112" stroke="var(--text-mute)" strokeOpacity=".5" />}
                        {[false, true].map(opponent => <g key={String(opponent)}>
                            {windows.map(window => <g key={window.start}>
                                {window.segments.slice(1).map((segment, i) => {
                                    const from = window.segments[i].at(-1), to = segment[0];
                                    return <line key={`gap-${to.at}`} data-gap="" x1={from.x} y1={y(opponent ? 1 - from.p : from.p)} x2={to.x} y2={y(opponent ? 1 - to.p : to.p)}
                                        stroke={colors[Number(opponent)]} strokeWidth="1.5" strokeDasharray="2 4" strokeOpacity=".5" />;
                                })}
                                {window.segments.map(segment => <g key={segment[0].at}>
                                    {segment.length > 1 && <path d={segment.map((p, j) => `${j ? 'L' : 'M'}${p.x},${y(opponent ? 1 - p.p : p.p)}`).join(' ')} fill="none" stroke={colors[Number(opponent)]} strokeWidth="2" />}
                                    {segment.map(p => {
                                        // A week holds ~200 samples, too many to dot individually.
                                        const marked = p === activePoint || p === last || segment.length === 1;
                                        return marked && <circle key={p.at} cx={p.x} cy={y(opponent ? 1 - p.p : p.p)} r={p === activePoint ? 4.5 : p === last ? 3.5 : 2}
                                            fill={colors[Number(opponent)]} stroke={p === activePoint ? 'var(--bg-1)' : 'none'} strokeWidth="1.5" />;
                                    })}
                                </g>)}
                            </g>)}
                        </g>)}
                    </svg>
                    {activePoint && <div role="status" className="pointer-events-none absolute top-0 z-10 rounded-md border border-line bg-bg-2 px-2 py-1.5 text-xs font-mono tnum shadow-card whitespace-nowrap"
                        style={{ left: active.left, transform: activePoint.x > VIEW_W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
                        <div className="text-text-mute">{dateTimeLabel(activePoint.at)}</div>
                        {[myName, oppName].map((name, i) => <div key={i} className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />
                            <span className="truncate max-w-[110px] text-text-dim">{name}</span>
                            <span className="ml-auto pl-2 text-text">{Math.round((i ? 1 - activePoint.p : activePoint.p) * 100)}%</span>
                        </div>)}
                    </div>}
                </div>
                <p className="text-xs font-mono tnum text-text-mute mt-2">{points.length === 1 ? dateTimeLabel(first.at) : `${dateTimeLabel(first.at)} – ${dateTimeLabel(last.at)}`}</p>
                {points.length === 1 && <p className="text-xs text-text-mute mt-2">{canRecord && !complete ? 'First sample saved. A line will appear after the next one.' : 'Only one sample was recorded for this matchup.'}</p>}
            </> : <p className="text-sm text-text-mute">{emptyMessage}</p>}
            <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3 text-xs font-mono">
                {[myName, oppName].map((name, i) => <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="w-3 h-0.5 shrink-0" style={{ background: colors[i] }} />
                    <span className="truncate max-w-[150px] text-text">{name}</span>
                    <span className="text-text-dim tnum">{current == null ? '—' : `${Math.round((i ? 1 - current : current) * 100)}%`}</span>
                </span>)}
            </div>
            {winProb == null && last && <p className="text-xs text-text-mute mt-2">Current estimate unavailable. Showing the last recorded probabilities.</p>}
            <p className="text-xs text-text-mute mt-3">Sampled about every 5 minutes while games are on, whether or not this page is open. Time between games is left out. Dashed lines mark missed samples, and earlier weeks can't be filled in.</p>
        </div>
    );
}
