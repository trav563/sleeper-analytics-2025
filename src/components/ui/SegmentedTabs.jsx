import { useId, useRef } from 'react';

export function SegmentedTabs({ tabs, value, onChange, className = '', label = 'View', panelId }) {
    const id = useId(), refs = useRef([]);
    const items = (tabs || []).map(t => typeof t === 'string' ? { value: t, label: t } : t);
    const selected = Math.max(0, items.findIndex(t => t.value === value));
    const keyDown = (event, index) => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % items.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = items.length - 1;
        else return;
        event.preventDefault(); onChange?.(items[next].value); refs.current[next]?.focus();
    };
    return <div className={`flex bg-bg-2 rounded-lg p-1 border border-line ${className}`} role="tablist" aria-label={label}>
        {items.map((t, i) => <button key={t.value} id={`${id}-${t.value}`} ref={el => { refs.current[i] = el; }} type="button" role="tab" aria-selected={value === t.value} aria-controls={panelId} tabIndex={i === selected ? 0 : -1}
            onKeyDown={e => keyDown(e, i)} onClick={() => onChange?.(t.value)} className={`flex-1 min-w-0 min-h-11 px-2 py-2 text-sm font-semibold rounded-md transition-colors ${value === t.value ? 'bg-bg-3 text-signal' : 'text-text-dim hover:text-text'}`}>{t.label}</button>)}
    </div>;
}
export default SegmentedTabs;
