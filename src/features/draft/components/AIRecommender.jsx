import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

const cacheKey = (draftId, pickNo, userId) => `draft_rec:${draftId}:${pickNo}:${userId}`;

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
 * Auto-fires when it's the user's turn (once per pick). Result is cached client-
 * and server-side keyed by (draftId, pickNo, userId), so reloads/back-button
 * don't burn extra calls.
 */
export default function AIRecommender({ draftId, leagueId, userId, pickNo, isMyTurn, draftType, picksUntilMine }) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);
    const lastFiredKey = useRef(null);

    const key = pickNo && userId && draftId ? cacheKey(draftId, pickNo, userId) : null;

    // Hydrate from localStorage when key changes
    useEffect(() => {
        if (!key) return;
        const cached = readCache(key);
        if (cached) {
            setText(cached);
            setError(null);
        } else {
            setText('');
        }
    }, [key]);

    const run = useCallback(async () => {
        if (!key) return;
        // Don't double-fire for the same key
        if (lastFiredKey.current === key) return;
        lastFiredKey.current = key;

        // If we already have a cached result, skip the network entirely
        if (readCache(key)) return;

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);
        setText('');

        try {
            const response = await fetch('/api/draft-recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftId, leagueId, userId, pickNo, draftType }),
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
            // Allow retry by clearing the fire-once guard on error
            lastFiredKey.current = null;
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, [key, draftId, leagueId, userId, pickNo, draftType]);

    // Auto-fire when it's the user's turn
    useEffect(() => {
        if (!isMyTurn || !key) return;
        run();
    }, [isMyTurn, key, run]);

    const onManualRetry = () => {
        if (key) {
            try { localStorage.removeItem(key); } catch { /* ignore */ }
        }
        lastFiredKey.current = null;
        run();
    };

    return (
        <div className="rounded-xl border border-signal/40 bg-gradient-to-br from-signal/30 to-bg-1/40">
            <div className="p-4 border-b border-signal/30 flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-signal" />
                    AI Pick Recommender
                </h3>
                {(text || error) && (
                    <Button variant="ghost" size="sm" onClick={onManualRetry} className="h-7 px-2 text-xs">
                        <RotateCw className="w-3 h-3 mr-1" />
                        Re-run
                    </Button>
                )}
            </div>
            <div className="p-4">
                {!isMyTurn && !text && (
                    <p className="text-sm text-text-mute text-center py-4">
                        {picksUntilMine != null
                            ? `Recommendations will appear when you're on the clock (${picksUntilMine} ${picksUntilMine === 1 ? 'pick' : 'picks'} away).`
                            : 'Recommendations will appear when you are on the clock.'}
                    </p>
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
