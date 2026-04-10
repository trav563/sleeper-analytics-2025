import { useState, useCallback, useRef } from 'react';

export function useAnalyzeTeam() {
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(null);
    const abortRef = useRef(null);

    const analyze = useCallback(async ({ leagueId, userId, week, analysisType = 'full' }) => {
        // Abort any in-progress request
        if (abortRef.current) {
            abortRef.current.abort();
        }

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

            // Handle non-streaming error responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    setRemaining(errorData.remaining ?? 0);
                    throw new Error(errorData.error || 'Rate limit exceeded');
                }
                throw new Error(errorData.error || `Request failed (${response.status})`);
            }

            // Read remaining from header
            const remainingHeader = response.headers.get('X-Remaining');
            if (remainingHeader !== null) {
                setRemaining(parseInt(remainingHeader, 10));
            }

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
                    const jsonStr = line.slice(6);
                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.done) break;
                        if (data.error) throw new Error(data.error);
                        if (data.text) {
                            fullText += data.text;
                            setAnalysis(fullText);
                        }
                    } catch (parseErr) {
                        if (parseErr.message !== 'done') {
                            // JSON parse error on a chunk, skip it
                        }
                    }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(err.message);
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, []);

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

    return { analysis, loading, error, remaining, analyze, cancel, clear };
}
