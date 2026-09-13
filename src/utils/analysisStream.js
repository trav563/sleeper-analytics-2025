export const ANALYSIS_VERSION = 2;
export const analysisCacheKey = (leagueId, userId, week, type, constraint) =>
    `ai_analysis:v${ANALYSIS_VERSION}:${leagueId}:${userId}:${week}:${type}:${constraint || 'default'}`;

export function readAnalysisCache(key) {
    try {
        const cached = JSON.parse(localStorage.getItem(key));
        return cached?.status === 'complete' && typeof cached.text === 'string' && cached.text.trim() && Number.isFinite(cached.timestamp) && Date.now() >= cached.timestamp && Date.now() - cached.timestamp < 7 * 86400000 ? cached : null;
    } catch { return null; }
}

/** SSE parser: transport EOF is never evidence of successful generation. */
export async function readAnalysisStream(body, onText = () => {}, onComplete = () => {}) {
    if (!body) throw new Error('Analysis stream unavailable. Please retry.');
    const reader = body.getReader(), decoder = new TextDecoder();
    let buffer = '', text = '', terminal = false;
    const consume = line => {
        if (!line.startsWith('data:')) return;
        let data;
        try { data = JSON.parse(line.slice(5).trim()); }
        catch { throw new Error('Analysis response was interrupted. Please retry.'); }
        if (data.error) throw new Error(data.error);
        if (data.text) { text += data.text; onText(text); }
        if (data.done) {
            if (data.status !== 'complete' || data.finishReason !== 'stop') throw new Error('Analysis was cut short. Please retry.');
            terminal = true;
            onComplete(data);
        }
    };
    try {
        while (!terminal) {
            const chunk = await reader.read();
            buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
            const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
            for (const line of lines) { consume(line); if (terminal) break; }
            if (chunk.done) { if (buffer && !terminal) consume(buffer); break; }
        }
        if (!terminal || !text.trim()) throw new Error('Analysis was cut short. Please retry.');
        return text;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
