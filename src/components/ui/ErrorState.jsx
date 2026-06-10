import { AlertTriangle } from 'lucide-react';

/**
 * Shared inline error panel with an optional retry action. Matches the
 * broadcast-scoreboard --bad token styling used across the app.
 */
const ErrorState = ({ message = 'Something went wrong.', onRetry, className = '' }) => (
    <div className={`flex justify-center items-center px-4 ${className}`}>
        <div className="max-w-md w-full p-4 rounded-md bg-bad/10 border border-bad/30 text-bad text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
                <span>{message}</span>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-2 block rounded-md border border-bad/40 px-3 py-1 text-xs font-medium text-bad transition-colors hover:bg-bad/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad"
                    >
                        Try again
                    </button>
                )}
            </div>
        </div>
    </div>
);

export default ErrorState;
