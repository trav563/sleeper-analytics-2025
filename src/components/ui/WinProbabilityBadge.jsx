import { formatWinProbabilityPercent } from '../../lib/winProbability';

export function WinProbabilityBadge({ probability, outcome = null }) {
    const isResult = outcome != null;
    return (
        <div aria-label={isResult ? `Matchup result: ${outcome}` : 'Estimated win probability'} className="shrink-0 px-3 py-2 rounded-md bg-bg-3 border border-line text-center">
            <div className="font-mono text-xs uppercase tracking-wider text-text-mute font-bold whitespace-nowrap">{isResult ? 'Result' : 'Est. Win'}</div>
            <div className={`font-display tnum text-xl font-extrabold leading-none mt-1 ${outcome === 'Loss' ? 'text-bad' : outcome === 'Tie' ? 'text-text' : 'text-good'}`}>
                {isResult ? outcome : probability == null ? '—' : formatWinProbabilityPercent(probability)}
            </div>
        </div>
    );
}
