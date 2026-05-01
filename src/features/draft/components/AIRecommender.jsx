import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCw, Clock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

const TRIGGER_DISTANCE = 5; // start pre-computing this many picks before user's turn

const cacheKey = (draftId, myNextPick, picksMadeCount, userId) =>
    `draft_rec:${draftId}:${userId}:np${myNextPick}:p${picksMadeCount}`;

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.text) return null;
        return parsed.text;
    } catch { return null; }
}

function writeCache(key, text) {
    try { localStorage.setItem(key, JSON.stringify({ text, ts: Date.now() })); } catch { /* ignore */ }
}

/**
 * Always-on recommender. Pre-computes top picks for the user's *next* slot
 * starting when they're within 5 picks of their turn, refreshing each pick
 * thereafter. Lets the user have a recommendation already on screen when
 * they go on the clock.
 *
 * Cache key includes `picksMadeCount` so each pick within the trigger window
 * invalidates and refires.
 */
export default function AIRecommender({
    draftId,
    leagueId,
    userId,
    myNextPick,
    isMyTurn,
    draftType,
    picksUntilMine,
    picksMadeCount,
}) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);
    const lastFiredKey = useRef(null);

    const isWithinWindow = picksUntilMine != null && picksUntilMine <= TRIGGER_DISTANCE;
    const key = isWithinWindow && myNextPick && userId && draftId
        ? cacheKey(draftId, myNextPick, picksMadeCount ?? 0, userId)
        : null;

    // Hydrate from localStorage when key changes
    useEffect(() => {
        if (!key) return;
        const cached = readCache(key);
        if (cached) {
            setText(cached);
            setError(null);
        }
    }, [key]);

    const run = useCallback(async () => {
        if (!key) return;
        if (lastFiredKey.current === key) return;
        lastFiredKey.current = key;

        if (readCache(key)) return;

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/draft-recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftId, leagueId, userId, pickNo: myNextPick, draftType }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Request failed (${response.status})`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let full = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.done) break;
                        if (data.error) throw new Error(data.error);
                        if (data.text) {
                            full += data.text;
                            setText(full);
                        }
                    } catch { /* skip parse errors */ }
                }
            }
            if (full) writeCache(key, full);
        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(err.message);
            lastFiredKey.current = null;
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, [key, draftId, leagueId, userId, myNextPick, draftType]);

    // Auto-fire when within the lookahead window. Each pick that lands
    // within the window changes `picksMadeCount` → key → refire.
    useEffect(() => {
        if (!key) return;
        run();
    }, [key, run]);

    const onManualRetry = () => {
        if (key) {
            try { localStorage.removeItem(key); } catch { /* ignore */ }
        }
        lastFiredKey.current = null;
        run();
    };

    const headerLabel = isMyTurn
        ? 'Recommended for this pick'
        : isWithinWindow
            ? `Recommended for pick #${myNextPick} (${picksUntilMine} away)`
            : myNextPick != null
                ? `Pre-analysis starts ${TRIGGER_DISTANCE - (picksUntilMine ?? 0) > 0 ? 'soon' : `at ${TRIGGER_DISTANCE} picks away`}`
                : 'AI Pick Recommender';

    return (
        <div className="rounded-xl border border-signal/40 bg-gradient-to-br from-signal/30 to-bg-1/40">
            <div className="p-4 border-b border-signal/30 flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-text">
                        <Sparkles className="w-4 h-4 text-signal" />
                        AI Pick Recommender
                    </h3>
                    <p className="text-2xs text-text-mute mt-0.5 truncate">{headerLabel}</p>
                </div>
                {(text || error) && (
                    <Button variant="ghost" size="sm" onClick={onManualRetry} className="h-7 px-2 text-xs shrink-0">
                        <RotateCw className="w-3 h-3 mr-1" />
                        Refresh
                    </Button>
                )}
            </div>
            <div className="p-4">
                {!isWithinWindow && !text && (
                    <div className="flex items-start gap-2 text-text-mute text-sm py-2">
                        <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>
                            {picksUntilMine != null && myNextPick != null
                                ? `Pre-analysis activates within ${TRIGGER_DISTANCE} picks of your turn — your next pick is #${myNextPick} (${picksUntilMine} away).`
                                : 'Pre-analysis activates as your turn approaches.'}
                        </p>
                    </div>
                )}

                {loading && !text && (
                    <div className="flex items-center gap-2 text-signal/80 text-sm py-2">
                        <div className="w-4 h-4 border-2 border-signal/80 border-t-transparent rounded-full animate-spin" />
                        Analyzing the board…
                    </div>
                )}

                {error && (
                    <div className="text-sm text-bad py-2">
                        Error: {error}
                    </div>
                )}

                {text && (
                    <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-sm">
                        {text}
                    </div>
                )}
            </div>
        </div>
    );
}
