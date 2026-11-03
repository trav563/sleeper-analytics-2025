import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { WinProbabilityChart } from './WinProbabilityChart';

const props = { myRosterId: 1, oppRosterId: 2, winProb: .8, myName: 'Team A', oppName: 'Team B', myHue: 45, oppHue: 200 };
const MIN = 60_000;
const start = Date.UTC(2026, 10, 6, 1, 0); // Thursday evening in the US.
const point = (minutes, p) => ({ at: start + minutes * MIN, p });
let container, root;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = overrides => act(() => root.render(<WinProbabilityChart {...props} {...overrides} />));
const svgOf = () => {
    const svg = container.querySelector('svg');
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 125 });
    return svg;
};

describe('win probability chart', () => {
    it('explains each empty state', () => {
        render(); expect(container.textContent).toContain('Tracking starts with the next game');
        render({ loading: true }); expect(container.textContent).toContain('Loading history');
        render({ unavailable: true }); expect(container.textContent).toContain('temporarily unavailable');
        render({ canRecord: false }); expect(container.textContent).toContain('No history was recorded');
    });
    it('shows first-sample guidance, then a line once there are two', () => {
        render({ points: [point(0, .6)] });
        expect(container.textContent).toContain('First sample saved');
        expect(container.querySelectorAll('path')).toHaveLength(0);
        render({ points: [point(0, .6), point(5, .8)] });
        expect(container.querySelectorAll('path')).toHaveLength(2);
    });
    it('does not promise more samples for a finished matchup', () => {
        render({ points: [point(0, 1)], complete: true });
        expect(container.textContent).toContain('Only one sample');
        expect(container.textContent).not.toContain('next one');
    });
    it('dashes over missed samples inside a game window', () => {
        render({ points: [point(0, .5), point(5, .6), point(40, .7), point(45, .8)] });
        expect(container.querySelectorAll('path')).toHaveLength(4);
        expect(container.querySelectorAll('line[data-gap]')).toHaveLength(2);
        expect(container.querySelectorAll('line[data-window-break]')).toHaveLength(0);
    });
    it('treats normal 5-minute sampling as continuous', () => {
        render({ points: Array.from({ length: 30 }, (_, i) => point(i * 5, .5)) });
        expect(container.querySelectorAll('line[data-gap]')).toHaveLength(0);
        expect(container.querySelectorAll('path')).toHaveLength(2);
    });
    it('separates game windows with a day label and no connecting line', () => {
        const sunday = 3 * 24 * 60;
        render({ points: [point(0, .5), point(5, .6), point(10, .6), point(sunday, .6), point(sunday + 5, .7), point(sunday + 10, .8)] });
        expect(container.querySelectorAll('line[data-window-break]')).toHaveLength(1);
        expect(container.querySelectorAll('line[data-gap]')).toHaveLength(0);
        const labels = [...container.querySelectorAll('svg text')].map(t => t.textContent);
        const day = at => new Date(at).toLocaleDateString([], { weekday: 'short' }).toUpperCase();
        expect(labels).toEqual(['100%', day(start), day(start + sunday * MIN)]);
    });
    it('shows probabilities for the nearest sample on hover or tap', () => {
        render({ points: [point(0, .5), point(30, .6), point(60, .8)] });
        const svg = svgOf();
        act(() => svg.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 150 })));
        const tip = container.querySelector('[role="status"]');
        expect(tip.textContent).toContain('Team A60%');
        expect(tip.textContent).toContain('Team B40%');
        act(() => svg.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300 })));
        expect(container.querySelector('[role="status"]').textContent).toContain('Team A80%');
    });
    it('flips perspective for the higher roster id', () => {
        render({ winProb: null, myRosterId: 2, oppRosterId: 1, points: [point(0, .8)] });
        const svg = svgOf();
        act(() => svg.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 160 })));
        expect(container.querySelector('[role="status"]').textContent).toContain('Team A20%');
    });
    it('retains history when the current estimate is unavailable', () => {
        render({ winProb: null, points: [point(0, .8), point(5, .9)] });
        expect(container.querySelectorAll('path')).toHaveLength(2);
        expect(container.textContent).toContain('Showing the last recorded probabilities');
    });
});
