import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { WinProbabilityChart } from './WinProbabilityChart';
import { HISTORY_STORAGE_KEY, probabilityHistoryKey, appendProbabilitySnapshot, subscribeProbabilityHistory } from '../../../lib/winProbabilityHistory';

const props = { leagueId: 'test-chart', season: '2026', week: 1, matchupId: 1, myRosterId: 1, oppRosterId: 2,
    winProb: .8, myName: 'Team A', oppName: 'Team B', myHue: 45, oppHue: 200 };
const key = probabilityHistoryKey({ ...props, rosterIds: [1, 2] });
let container, root;
const now = Date.now() - 600_000;
const add = (offset, p) => act(() => appendProbabilitySnapshot(key, { at: now + offset, p, source: String(offset) }));
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    const unsubscribe = subscribeProbabilityHistory(() => {});
    window.dispatchEvent(new StorageEvent('storage', { key: HISTORY_STORAGE_KEY })); unsubscribe();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = overrides => act(() => root.render(<WinProbabilityChart {...props} {...overrides} />));

describe('recorded probability chart', () => {
    it('shows first-observation guidance then draws lines as real snapshots arrive', () => {
        render(); expect(container.textContent).toContain('No recorded history yet');
        add(0, .6); expect(container.textContent).toContain('First observation saved');
        expect(container.querySelectorAll('path')).toHaveLength(0);
        add(60_000, .8); expect(container.querySelectorAll('path')).toHaveLength(2);
        expect(container.textContent).toContain('Recording began');
    });
    it('uses elapsed time for spacing and does not draw through recording gaps', () => {
        add(0, .5); add(60_000, .6); add(180_000, .8); render();
        expect(container.querySelector('path').getAttribute('d')).toContain('L110.666');
        add(600_000, .9);
        expect(container.querySelectorAll('path')).toHaveLength(2); // Seven-minute gap is not a solid recorded line...
        expect(container.querySelectorAll('line[data-gap]')).toHaveLength(2); // ...but a dashed connector per team.
    });
    it('shows recorded probabilities for the nearest observation on hover or tap', () => {
        add(0, .5); add(60_000, .6); add(120_000, .8); render();
        const svg = container.querySelector('svg');
        svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 125 });
        act(() => svg.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 150 })));
        const tip = container.querySelector('[role="status"]');
        expect(tip.textContent).toContain('Team A60%');
        expect(tip.textContent).toContain('Team B40%');
        act(() => svg.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300 })));
        expect(container.querySelector('[role="status"]').textContent).toContain('Team A80%');
    });
    it('changes perspective without mixing team or week histories', () => {
        add(0, .8); render({ winProb: null, myRosterId: 2, oppRosterId: 1 });
        const svg = container.querySelector('svg');
        svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 125 });
        act(() => svg.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 160 })));
        expect(container.querySelector('[role="status"]').textContent).toContain('Team A20%');
        render({ week: 2 });
        expect(container.querySelectorAll('circle')).toHaveLength(0);
        render(); expect(container.querySelectorAll('circle')).toHaveLength(2);
    });
    it('retains history during unavailable current data', () => {
        add(0, .8); add(60_000, .9); render({ winProb: null });
        expect(container.querySelectorAll('path')).toHaveLength(2);
        expect(container.textContent).toContain('Showing the last recorded probabilities');
    });
    it('does not promise new observations for a finished or historical matchup', () => {
        render({ canRecord: false });
        expect(container.textContent).toContain('No history was recorded');
        add(0, 1); render({ complete: true });
        expect(container.textContent).toContain('Only one observation');
        expect(container.textContent).not.toContain('next score refresh');
    });
});
