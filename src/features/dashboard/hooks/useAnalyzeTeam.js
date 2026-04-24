import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(leagueId, userId, week, analysisType, constraint) {
    const c = constraint ? `:${constraint}` : '';
    return `ai_analysis:${leagueId}:${userId}:${week}:${analysisType}${c}`;
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
        // localStorage full or unavailable
    }
}

function getCooldownRemaining(cached, cooldownMs) {
    if (!cached) return 0;
    const elapsed = Date.now() - cached.timestamp;
    return Math.max(0, cooldownMs - elapsed);
}

export function useAnalyzeTeam({
    leagueId,
    userId,
    week,
    analysisType = 'roster',
    cooldownMs = DEFAULT_COOLDOWN_MS,
} = {}) {
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(null);
    const [cachedAt, setCachedAt] = useState(null);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [activeConstraint, setActiveConstraint] = useState(null);
    const abortRef = useRef(null);
    const timerRef = useRef(null);

    const cacheKey = leagueId && userId && week
        ? getCacheKey(leagueId, userId, week, analysisType, activeConstraint)
        : null;

    // Load cached result when params change
    useEffect(() => {
        if (!cacheKey) return;
        const cached = readCache(cacheKey);
        if (cached) {
            setAnalysis(cached.text);
            setCachedAt(cached.timestamp);
            setCooldownRemaining(getCooldownRemaining(cached, cooldownMs));
        } else {
            setAnalysis('');
            setCachedAt(null);
            setCooldownRemaining(0);
        }
        setError(null);
    }, [cacheKey, cooldownMs]);

    // Cooldown countdown timer
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (cooldownRemaining <= 0) return;

        timerRef.current = setInterval(() => {
            if (!cacheKey) return;
            const cached = readCache(cacheKey);
            const rem = getCooldownRemaining(cached, cooldownMs);
            setCooldownRemaining(rem);
            if (rem <= 0) clearInterval(timerRef.current);
        }, 30000);

        return () => clearInterval(timerRef.current);
    }, [cooldownRemaining, cacheKey, cooldownMs]);

    const analyze = useCallback(async ({ force = false, constraint = null } = {}) => {
        if (!leagueId || !userId || !week) return;

        const effectiveCacheKey = getCacheKey(leagueId, userId, week, analysisType, constraint);
        setActiveConstraint(constraint);

        if (!force) {
            const cached = readCache(effectiveCacheKey);
            const rem = getCooldownRemaining(cached, cooldownMs);
            if (cached && rem > 0) {
                setAnalysis(cached.text);
                setCachedAt(cached.timestamp);
                setCooldownRemaining(rem);
                setError(null);
                return;
            }
        } else {
            try { localStorage.removeItem(effectiveCacheKey); } catch {}
        }

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
                body: JSON.stringify({ leagueId, userId, week, analysisType, constraint }),
                signal: controller.signal,
            });

            if (!response.ok) {
                let serverMessage = '';
                try {
                    const errorData = await response.json();
                    serverMessage = errorData?.error || '';
                    if (response.status === 429) {
                        setRemaining(errorData.remaining ?? 0);
                    }
                } catch {
                    // body wasn't JSON
                }
                if (!serverMessage) {
                    if (response.status === 429) serverMessage = 'Rate limit reached. Try again later.';
                    else if (response.status === 500) serverMessage = 'AI service error. Check that GEMINI_API_KEY is set in Vercel.';
                    else serverMessage = `Request failed (${response.status}).`;
                }
                throw new Error(serverMessage);
            }

            const remainingHeader = response.headers.get('X-Remaining');
            if (remainingHeader !== null) setRemaining(parseInt(remainingHeader, 10));

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';
            let streamError = null;

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
                        if (data.error) { streamError = data.error; break; }
                        if (data.text) {
                            fullText += data.text;
                            setAnalysis(fullText);
                        }
                    } catch {
                        // Skip parse errors on chunks
                    }
                }
                if (streamError) break;
            }

            if (streamError) throw new Error(streamError);

            if (fullText) {
                writeCache(effectiveCacheKey, fullText);
                setCachedAt(Date.now());
                setCooldownRemaining(cooldownMs);
            } else {
                throw new Error('No response from AI service. Check that GEMINI_API_KEY is configured.');
            }

        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(err.message);
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, [leagueId, userId, week, analysisType, cooldownMs]);

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
        setActiveConstraint(null);
    }, []);

    const isOnCooldown = cooldownRemaining > 0 && !loading;
    const cooldownMinutes = Math.ceil(cooldownRemaining / 60000);

    return {
        analysis, loading, error, remaining,
        cachedAt, isOnCooldown, cooldownMinutes,
        activeConstraint,
        analyze, cancel, clear
    };
}
