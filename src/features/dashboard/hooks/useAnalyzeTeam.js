import { useState, useCallback, useRef, useEffect } from 'react';
import { readAnalysisStream, analysisCacheKey, readAnalysisCache } from '../../../utils/analysisStream';

const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;

export function useAnalyzeTeam({ leagueId, userId, week, analysisType = 'roster', cooldownMs = DEFAULT_COOLDOWN_MS } = {}) {
    const identity = `${leagueId}:${userId}:${week}:${analysisType}`;
    const [selection, setSelection] = useState({ identity, constraint: null });
    const constraint = selection.identity === identity ? selection.constraint : null;
    const key = analysisCacheKey(leagueId, userId, week, analysisType, constraint);
    const [result, setResult] = useState(null);
    const [clock, setClock] = useState(() => Date.now());
    const request = useRef(null);
    const identityRef = useRef(identity);
    useEffect(() => {
        identityRef.current = identity;
        return () => { request.current?.abort(); request.current = null; };
    }, [identity]);
    useEffect(() => {
        const timer = setInterval(() => setClock(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);

    const cached = readAnalysisCache(key);
    const current = result?.key === key ? result : { ...cached, text: cached?.text || '', timestamp: cached?.timestamp || null };
    const loading = !!current.loading;
    const cooldownRemaining = current.timestamp ? Math.max(0, current.timestamp + cooldownMs - clock) : 0;

    const analyze = useCallback(async ({ force = false, constraint: next = null } = {}) => {
        if (!leagueId || !userId || !week) return;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const requestKey = analysisCacheKey(leagueId, userId, week, analysisType, next);
        setSelection({ identity, constraint: next });
        const prior = readAnalysisCache(requestKey);
        const active = () => request.current === controller && !controller.signal.aborted && identityRef.current === identity;
        if (!force && prior && Date.now() - prior.timestamp < cooldownMs) {
            setResult({ key: requestKey, ...prior, loading: false });
            request.current = null;
            return;
        }
        setResult({ key: requestKey, text: prior?.text || '', timestamp: prior?.timestamp, loading: true, error: null });
        try {
            const response = await fetch('/api/analyze-team', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leagueId, userId, week, analysisType, constraint: next }), signal: controller.signal,
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || `Analysis unavailable (${response.status}). Please try again.`);
            }
            let metadata;
            const text = await readAnalysisStream(response.body, partial => {
                if (active()) setResult(r => ({ ...r, text: partial, loading: true, incomplete: true }));
            }, event => { metadata = event.valuation; });
            if (!active()) return;
            const complete = { key: requestKey, text, timestamp: Date.now(), status: 'complete', valuation: metadata, loading: false, incomplete: false };
            try { localStorage.setItem(requestKey, JSON.stringify(complete)); } catch { /* Storage is optional. */ }
            setClock(Date.now());
            setResult(complete);
        } catch (error) {
            if (active()) setResult(r => ({ ...r, error: error.message, loading: false, incomplete: true }));
        } finally {
            if (active()) request.current = null;
        }
    }, [leagueId, userId, week, analysisType, cooldownMs, identity]);

    const cancel = useCallback(() => {
        request.current?.abort(); request.current = null;
        setResult(r => r ? { ...r, loading: false, incomplete: true, error: 'Analysis canceled. Retry when ready.' } : r);
    }, []);
    const clear = useCallback(() => {
        cancel();
        setSelection({ identity, constraint: null });
        setResult(null);
    }, [cancel, identity]);

    return { analysis: current.text || '', loading, error: current.error, incomplete: current.incomplete,
        valuation: current.valuation, cachedAt: current.timestamp, isOnCooldown: cooldownRemaining > 0 && !loading,
        cooldownMinutes: Math.ceil(cooldownRemaining / 60000), activeConstraint: constraint,
        analyze, cancel, clear };
}
