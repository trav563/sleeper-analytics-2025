/**
 * Local-storage housekeeping.
 *
 * The app keeps a Sleeper profile and cached AI narratives in localStorage.
 * Those persist on shared machines, so there has to be a way to remove them,
 * and the AI cache has to expire — it holds full LLM write-ups about a league
 * (manager names, records, rosters) and previously grew without bound.
 */

const AI_PREFIX = 'ai_analysis:';
const AI_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Remove every key matching a prefix. Returns how many were removed. */
function removeByPrefix(prefix, shouldRemove = () => true) {
    let removed = 0;
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(prefix)) continue;
            if (!shouldRemove(key)) continue;
            localStorage.removeItem(key);
            removed++;
        }
    } catch {
        // Private mode / quota errors are non-fatal here.
    }
    return removed;
}

/** Drop AI analyses older than the max age. Call once on mount. */
export function pruneAiAnalysisCache() {
    return removeByPrefix(AI_PREFIX, (key) => {
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            return !parsed?.timestamp || Date.now() - parsed.timestamp > AI_MAX_AGE_MS;
        } catch {
            return true; // unparseable → drop it
        }
    });
}

/**
 * Forget the signed-in user and everything derived from them. Theme is kept —
 * it is a display preference, not identity.
 */
export function clearLocalUserData() {
    try {
        localStorage.removeItem('sleeper_user');
    } catch { /* ignore */ }
    removeByPrefix(AI_PREFIX);
    removeByPrefix('playoffOdds:');
    removeByPrefix('schedule_generator_');
}
