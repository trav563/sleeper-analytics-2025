import { formatWinProbabilityPercent } from '../../lib/winProbability';

export function WinProbabilityBadge({ probability }) {
    return (
        <div aria-label="Estimated win probability" className="shrink-0 px-3 py-2 rounded-md bg-bg-3 border border-line text-center">
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold whitespace-nowrap">Est. Win</div>
            <div className="font-display tnum text-xl font-extrabold text-good leading-none mt-1">
                {probability == null ? '—' : formatWinProbabilityPercent(probability)}
            </div>
        </div>
    );
}
