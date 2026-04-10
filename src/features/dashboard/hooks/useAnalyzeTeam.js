import { useState, useCallback, useRef, useEffect } from 'react';

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(leagueId, userId, week, analysisType) {
    return `ai_analysis:${leagueId}:${userId}:${week}:${analysisType}`;
}

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached.text || !cached.timestamp) return null;
        return cached;
    } catch {
        return null;
    }
}

function writeCache(key, text) {
    try {
        localStorage.setItem(key, JSON.stringify({ text, timestamp: Date.now() }));
    } catch {
        // localStorage full or unavailable — ignore
    }
}

function getCooldownRemaining(cached) {
    if (!cached) return 0;
    const elapsed = Date.now() - cached.timestamp;
    return Math.max(0, COOLDOWN_MS - elapsed);
}

export function useAnalyzeTeam({ leagueId, userId, week, analysisType = 'full' } = {}) {
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(null);
    const [cachedAt, setCachedAt] = useState(null);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const abortRef = useRef(null);
    const timerRef = useRef(null);

    const cacheKey = leagueId && userId && week ? getCacheKey(leagueId, userId, week, analysisType) : null;

    // Load cached result when params change
    useEffect(() => {
        if (!cacheKey) return;
        const cached = readCache(cacheKey);
        if (cached) {
            setAnalysis(cached.text);
            setCachedAt(cached.timestamp);
            setCooldownRemaining(getCooldownRemaining(cached));
        } else {
            setAnalysis('');
            setCachedAt(null);
            setCooldownRemaining(0);
        }
        setError(null);
    }, [cacheKey]);

    // Cooldown countdown timer
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (cooldownRemaining <= 0) return;

        timerRef.current = setInterval(() => {
            if (!cacheKey) return;
            const cached = readCache(cacheKey);
            const remaining = getCooldownRemaining(cached);
            setCooldownRemaining(remaining);
            if (remaining <= 0) clearInterval(timerRef.current);
        }, 30000); // Update every 30 seconds

        return () => clearInterval(timerRef.current);
    }, [cooldownRemaining, cacheKey]);

    const analyze = useCallback(async () => {
        if (!leagueId || !userId || !week) return;

        // Check cooldown
        if (cacheKey) {
            const cached = readCache(cacheKey);
            const remaining = getCooldownRemaining(cached);
            if (remaining > 0) {
                setCooldownRemaining(remaining);
                setError(`Analysis cached. Re-analyze available in ${Math.ceil(remaining / 60000)} minutes.`);
                return;
            }
        }

        // Abort any in-progress request
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);
        setAnalysis('');

        try {
            const response = await fetch('/api/analyze-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leagueId, userId, week, analysisType }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    setRemaining(errorData.remaining ?? 0);
                    throw new Error(errorData.error || 'Rate limit exceeded');
                }
                throw new Error(errorData.error || `Request failed (${response.status})`);
            }

            const remainingHeader = response.headers.get('X-Remaining');
            if (remainingHeader !== null) setRemaining(parseInt(remainingHeader, 10));

            // Read SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

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
                            fullText += data.text;
                            setAnalysis(fullText);
                        }
                    } catch (parseErr) {
                        // Skip parse errors on chunks
                    }
                }
            }

            // Cache the completed result
            if (fullText && cacheKey) {
                writeCache(cacheKey, fullText);
                setCachedAt(Date.now());
                setCooldownRemaining(COOLDOWN_MS);
            }

        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(err.message);
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, [leagueId, userId, week, analysisType, cacheKey]);

    const cancel = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
            setLoading(false);
        }
    }, []);

    const clear = useCallback(() => {
        setAnalysis('');
        setError(null);
    }, []);

    const isOnCooldown = cooldownRemaining > 0 && !loading;
    const cooldownMinutes = Math.ceil(cooldownRemaining / 60000);

    return {
        analysis, loading, error, remaining,
        cachedAt, isOnCooldown, cooldownMinutes,
        analyze, cancel, clear
    };
}
