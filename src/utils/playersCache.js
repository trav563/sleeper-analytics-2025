const DB_NAME = 'sleeper-analytics';
const STORE = 'kv';
const KEY = 'nflPlayers';
const TTL = 24 * 60 * 60 * 1000; // matches the 24h staleTime in useLeagueData

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Read the cached NFL players blob. Returns null when missing, expired,
 * or IndexedDB is unavailable (e.g. some private-browsing modes).
 */
export async function readPlayersCache() {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
            req.onsuccess = () => {
                const entry = req.result;
                resolve(entry && Date.now() - entry.time < TTL ? entry.data : null);
            };
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

/**
 * Persist the NFL players blob. Best-effort: failures (quota, private mode)
 * are swallowed — the app just refetches next session.
 */
export async function writePlayersCache(data) {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ data, time: Date.now() }, KEY);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        // best-effort
    }
}
