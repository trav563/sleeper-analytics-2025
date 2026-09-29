import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { SleeperProvider } from '../../../context/SleeperContext';
import UserSearch from './UserSearch';
const api = vi.hoisted(() => ({ user: vi.fn(), leagues: vi.fn() }));
vi.mock('../../../utils/sleeper', () => ({ fetchNFLState: async () => ({ season: '2026' }), fetchUser: (...args) => api.user(...args), fetchUserLeagues: (...args) => api.leagues(...args) }));
let host, root;
beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); api.user.mockReset(); api.leagues.mockReset();
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(<SleeperProvider><MemoryRouter><UserSearch /></MemoryRouter></SleeperProvider>));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const fill = async value => act(async () => {
    const input = host.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = async () => act(async () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
it('announces blank and whitespace input instead of silently doing nothing', async () => {
    await fill('  '); await submit();
    expect(host.querySelector('[role="alert"]').textContent).toContain('Enter your Sleeper username');
    expect(api.user).not.toHaveBeenCalled();
});
it('trims lookup input and offers a retry when the user has no leagues', async () => {
    api.user.mockResolvedValue({ user_id: 'u1', display_name: 'Test', username: 'test' }); api.leagues.mockResolvedValue([]);
    await fill(' test '); await submit();
    expect(api.user).toHaveBeenCalledWith('test');
    expect(host.textContent).toContain('No leagues found');
    expect(host.textContent).toContain('Retry league lookup');
    expect(host.querySelector('select').disabled).toBe(true);
});
it('retains input and gives recovery guidance after a failed lookup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.user.mockRejectedValue(new Error('HTTP 503')); await fill('test'); await submit();
    expect(host.querySelector('input').value).toBe('test');
    expect(host.querySelector('[role="alert"]').textContent).toContain('Check your connection');
    expect(host.textContent).not.toContain('HTTP 503');
});
