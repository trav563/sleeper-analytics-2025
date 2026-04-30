import { useCallback, useEffect, useState } from 'react';

const KEY = (draftId) => `draft_queue:${draftId}`;
const META_KEY = 'draft_queue_meta';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readQueue(draftId) {
    try {
        const raw = localStorage.getItem(KEY(draftId));
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

function writeQueue(draftId, set) {
    try {
        localStorage.setItem(KEY(draftId), JSON.stringify([...set]));
        // Touch metadata for cleanup
        const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
        meta[draftId] = Date.now();
        localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch { /* quota or unavailable */ }
}

/** One-time cleanup of stale per-draft queues. Runs lazily on first import. */
let didCleanup = false;
function cleanupStale() {
    if (didCleanup) return;
    didCleanup = true;
    try {
        const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
        const cutoff = Date.now() - MAX_AGE_MS;
        let changed = false;
        for (const [draftId, ts] of Object.entries(meta)) {
            if (ts < cutoff) {
                localStorage.removeItem(KEY(draftId));
                delete meta[draftId];
                changed = true;
            }
        }
        if (changed) localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch { /* ignore */ }
}

/**
 * Per-draft queue of starred player IDs, persisted to localStorage.
 */
export function useDraftQueue(draftId) {
    const [queue, setQueue] = useState(() => {
        cleanupStale();
        return draftId ? readQueue(draftId) : new Set();
    });

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (draftId) setQueue(readQueue(draftId));
    }, [draftId]);

    const toggle = useCallback((playerId) => {
        if (!draftId || !playerId) return;
        setQueue((prev) => {
            const next = new Set(prev);
            if (next.has(playerId)) next.delete(playerId);
            else next.add(playerId);
            writeQueue(draftId, next);
            return next;
        });
    }, [draftId]);

    const clear = useCallback(() => {
        if (!draftId) return;
        setQueue(new Set());
        writeQueue(draftId, new Set());
    }, [draftId]);

    const isQueued = useCallback((playerId) => queue.has(playerId), [queue]);

    return { queue, toggle, clear, isQueued, count: queue.size };
}
