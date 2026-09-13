import { createContext, useContext, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

const DialogContext = createContext({});
const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
export function Dialog({ open, onOpenChange, children }) {
    const ref = useRef(null), callback = useRef(onOpenChange), titleId = useId();
    useEffect(() => { callback.current = onOpenChange; }, [onOpenChange]);
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        (ref.current.querySelector(focusable) || ref.current).focus();
        const outside = [...document.body.children].filter(el => el !== ref.current);
        const prior = outside.map(el => el.inert);
        outside.forEach(el => { el.inert = true; });
        return () => { document.body.style.overflow = overflow; outside.forEach((el, i) => { el.inert = prior[i]; }); previous?.focus(); };
    }, [open]);
    if (!open) return null;
    const keys = e => {
        if (e.key === 'Escape') { e.preventDefault(); callback.current(false); }
        if (e.key !== 'Tab') return;
        const list = [...ref.current.querySelectorAll(focusable)].filter(el => el.getClientRects().length);
        if (!list.length) { e.preventDefault(); ref.current.focus(); return; }
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    return createPortal(<div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={keys} onClick={e => { if (e.target === e.currentTarget) onOpenChange(false); }} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <DialogContext.Provider value={{ titleId }}>{children}</DialogContext.Provider>
    </div>, document.body);
}
export const DialogContent = ({ className, children }) => <div className={cn('relative w-full max-h-[85dvh] overflow-y-auto rounded-lg shadow-lg', className)}>{children}</div>;
export const DialogHeader = ({ className, children }) => <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;
export function DialogTitle({ className, children }) { const { titleId } = useContext(DialogContext); return <h3 id={titleId} className={cn('font-semibold leading-none tracking-tight', className)}>{children}</h3>; }
export const DialogDescription = ({ className, children }) => <div className={cn('text-sm text-text-dim', className)}>{children}</div>;
