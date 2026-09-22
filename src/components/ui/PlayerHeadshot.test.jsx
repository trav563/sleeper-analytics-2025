import { beforeEach, afterEach, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayerHeadshot } from './PlayerHeadshot';
let host, root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); root = createRoot(host); });
afterEach(() => act(() => root.unmount()));
it('stops after two image failures and resets for a different player', () => {
    act(() => root.render(<PlayerHeadshot playerId="123" />));
    act(() => host.querySelector('img').dispatchEvent(new Event('error')));
    expect(host.querySelector('img').src).toContain('player_default');
    act(() => host.querySelector('img').dispatchEvent(new Event('error')));
    expect(host.querySelector('img')).toBeNull();
    act(() => root.render(<PlayerHeadshot playerId="456" />));
    expect(host.querySelector('img').src).toContain('/456.jpg');
});
it('uses a team logo for a defense and a local placeholder without an ID', () => {
    act(() => root.render(<PlayerHeadshot playerId="BAL" />));
    expect(host.querySelector('img').src).toContain('team_logos/nfl/bal.png');
    act(() => root.render(<PlayerHeadshot />));
    expect(host.querySelector('img')).toBeNull();
});
