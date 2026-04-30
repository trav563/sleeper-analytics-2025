import { useEffect, useState } from 'react';

/**
 * Returns true when the tab is visible. Used to pause polling when the user
 * switches away — saves bandwidth and Sleeper request budget.
 */
export function usePageVisibility() {
    const [visible, setVisible] = useState(
        typeof document === 'undefined' ? true : !document.hidden
    );

    useEffect(() => {
        const onChange = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);

    return visible;
}
