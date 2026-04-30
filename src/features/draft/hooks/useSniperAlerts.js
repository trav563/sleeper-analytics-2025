import { useEffect, useRef, useState } from 'react';

/**
 * Watches the picks array; when a new pick lands and that player was in the
 * user's queue, emits an alert. Consumers render a toast for each entry.
 * Self-cleans entries after `dismissMs`.
 */
export function useSniperAlerts({ picks, isQueued, players, dismissMs = 6000 }) {
    const [alerts, setAlerts] = useState([]);
    const seenCount = useRef(0);

    useEffect(() => {
        if (!picks) return;
        // Initial snapshot — don't fire alerts for picks that already existed
        // when the user landed on the page.
        if (seenCount.current === 0 && picks.length > 0) {
            seenCount.current = picks.length;
            return;
        }
        if (picks.length <= seenCount.current) {
            seenCount.current = picks.length;
            return;
        }

        const newPicks = picks.slice(seenCount.current);
        seenCount.current = picks.length;

        const newAlerts = [];
        for (const pick of newPicks) {
            if (!pick.player_id || !isQueued(pick.player_id)) continue;
            const p = players?.[pick.player_id];
            const name = p
                ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
                : pick.metadata?.first_name + ' ' + pick.metadata?.last_name;
            newAlerts.push({
                id: `${pick.pick_no}-${pick.player_id}`,
                name: name || 'Player',
                pos: p?.position || pick.metadata?.position || '?',
                team: p?.team || pick.metadata?.team || 'FA',
                pickNo: pick.pick_no,
                ts: Date.now(),
            });
        }
        if (newAlerts.length) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAlerts((cur) => [...cur, ...newAlerts]);
        }
    }, [picks, isQueued, players]);

    // Auto-dismiss
    useEffect(() => {
        if (alerts.length === 0) return;
        const timers = alerts.map((a) => {
            const remaining = dismissMs - (Date.now() - a.ts);
            return setTimeout(() => {
                setAlerts((cur) => cur.filter((x) => x.id !== a.id));
            }, Math.max(0, remaining));
        });
        return () => timers.forEach(clearTimeout);
    }, [alerts, dismissMs]);

    const dismiss = (id) => setAlerts((cur) => cur.filter((a) => a.id !== id));

    return { alerts, dismiss };
}
