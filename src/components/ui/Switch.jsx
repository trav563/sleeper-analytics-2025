import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
const Switch = forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => <button
    type="button" role="switch" aria-checked={checked} data-state={checked ? 'checked' : 'unchecked'}
    className={cn('inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal disabled:cursor-not-allowed disabled:opacity-50', className)}
    onClick={() => onCheckedChange?.(!checked)} ref={ref} {...props}>
    <span aria-hidden="true" className={cn('inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', checked ? 'bg-signal' : 'bg-bg-3 border border-line-strong')}>
        <span className={cn('block h-4 w-4 rounded-full shadow-sm transition-transform', checked ? 'translate-x-4 bg-bg' : 'translate-x-0 bg-text-dim')} />
    </span>
</button>);
Switch.displayName = 'Switch';
export { Switch };
