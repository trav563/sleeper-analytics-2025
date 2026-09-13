// In-memory only: retain inputs across tool/page navigation, clear on sign-out.
const entries = new Map();
export const readToolSession = key => entries.get(key);
export function writeToolSession(key, value) {
    if (entries.size >= 100 && !entries.has(key)) entries.delete(entries.keys().next().value);
    entries.set(key, value);
}
export const clearToolSession = () => entries.clear();
