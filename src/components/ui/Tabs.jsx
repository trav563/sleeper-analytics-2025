import { createContext, useContext, useId, useState } from 'react';
import { cn } from '../../lib/utils';
const TabsContext = createContext({});
export function Tabs({ defaultValue, className, children }) {
    const [activeTab, setActiveTab] = useState(defaultValue), id = useId();
    return <TabsContext.Provider value={{ activeTab, setActiveTab, id }}><div className={className}>{children}</div></TabsContext.Provider>;
}
export const TabsList = ({ className, children }) => <div role="tablist" className={cn('flex flex-wrap gap-1 p-1 rounded-lg bg-bg-2', className)}>{children}</div>;
export function TabsTrigger({ value, className, children }) {
    const { activeTab, setActiveTab, id } = useContext(TabsContext);
    const active = activeTab === value;
    const keyDown = e => {
        const tabs = [...e.currentTarget.parentElement.querySelectorAll('[role="tab"]')], index = tabs.indexOf(e.currentTarget);
        const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (next != null) { e.preventDefault(); tabs[next].focus(); tabs[next].click(); }
    };
    return <button type="button" role="tab" id={`${id}-tab-${value}`} aria-controls={`${id}-panel-${value}`} aria-selected={active} tabIndex={active ? 0 : -1} onKeyDown={keyDown} onClick={() => setActiveTab(value)} className={cn('min-h-11 px-3 py-2 rounded-md text-sm font-semibold', active ? 'bg-bg-3 text-signal' : 'text-text-dim hover:text-text', className)}>{children}</button>;
}
export function TabsContent({ value, className, children }) {
    const { activeTab, id } = useContext(TabsContext);
    if (activeTab !== value) return null;
    return <div role="tabpanel" tabIndex={0} id={`${id}-panel-${value}`} aria-labelledby={`${id}-tab-${value}`} className={className}>{children}</div>;
}
