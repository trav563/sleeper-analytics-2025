import { formatRecord } from '../../../utils/rivalries';

/**
 * One manager against every other manager: a row per opponent, a lifetime record,
 * and a column per season that manager actually played.
 *
 * Stateless. Table markup follows the house style in TrueStandings.jsx.
 */
const RivalryManagerTable = ({ seasons, rows, total, nameOf, scope, ownerId, onOpenPair }) => {
    if (!rows?.length) {
        return (
            <div className="py-10 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                No opponents to show
            </div>
        );
    }

    if (!seasons.length) {
        return (
            <div className="py-10 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                No games played yet
            </div>
        );
    }

    const showPlayoffMark = scope === 'all';
    const anyPlayoffMark =
        showPlayoffMark &&
        rows.some((row) => seasons.some((s) => (row.bySeason[s]?.playoffGames ?? 0) > 0));

    // Per-season totals across every opponent, for the footer.
    const seasonTotals = seasons.map((s) =>
        rows.reduce(
            (acc, row) => {
                const sp = row.bySeason[s];
                if (sp) {
                    acc.w += sp.w;
                    acc.l += sp.l;
                    acc.t += sp.t;
                }
                return acc;
            },
            { w: 0, l: 0, t: 0 }
        )
    );

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2">
                            <th className="px-3 py-2.5">Opponent</th>
                            <th className="px-3 py-2.5 text-center">Lifetime</th>
                            {seasons.map((s) => (
                                <th key={s} className="px-3 py-2.5 text-center tnum">
                                    {s}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.opponentId}
                                className="border-b border-line hover:bg-bg-2/60 transition-colors duration-fast"
                            >
                                <td className="px-3 py-3">
                                    <button
                                        type="button"
                                        onClick={() => onOpenPair?.(ownerId, row.opponentId)}
                                        className="min-h-[44px] text-left font-semibold text-text hover:text-signal transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-signal rounded-sm truncate max-w-[140px] sm:max-w-none"
                                    >
                                        {nameOf(row.opponentId)}
                                    </button>
                                </td>
                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                    <span className="tnum font-display font-bold text-signal">
                                        {formatRecord(row.total)}
                                    </span>
                                    <span className="font-mono text-2xs text-text-mute tnum ml-1.5">
                                        ({row.total.g})
                                    </span>
                                </td>
                                {seasons.map((s) => {
                                    const sp = row.bySeason[s];
                                    return (
                                        <td
                                            key={s}
                                            className="px-3 py-3 text-center tnum text-text-dim whitespace-nowrap"
                                        >
                                            {sp ? formatRecord(sp) : <span className="text-text-mute">—</span>}
                                            {showPlayoffMark && (sp?.playoffGames ?? 0) > 0 && (
                                                <span className="text-signal-2" aria-hidden="true">*</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2">
                            <td className="px-3 py-2.5">Total · vs current managers</td>
                            <td className="px-3 py-2.5 text-center tnum text-text font-bold whitespace-nowrap">
                                {formatRecord(total)}
                                <span className="text-text-mute ml-1.5">({total.g})</span>
                            </td>
                            {seasonTotals.map((agg, i) => (
                                <td key={seasons[i]} className="px-3 py-2.5 text-center tnum">
                                    {formatRecord(agg)}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mt-3 space-y-1">
                {anyPlayoffMark && (
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        <span className="text-signal-2">*</span> includes a playoff meeting
                    </p>
                )}
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    Totals cover current league members only — games against departed managers are
                    not counted
                </p>
            </div>
        </>
    );
};

export default RivalryManagerTable;
