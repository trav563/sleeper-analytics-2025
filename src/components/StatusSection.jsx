import { STATUS_COLORS } from '../utils/nflData';

const StatusSection = ({ title, items, tone, onTeamClick }) => {
    const { LIGHT, DOT } = STATUS_COLORS;

    // Add pulse animation class for incomplete items
    const pulseClass = tone === 'INCOMPLETE' ? 'animate-pulse' : '';
    const itemClass = tone === 'INCOMPLETE'
        ? 'bg-red-50 border border-red-200 rounded-lg p-3 hover:bg-red-100 transition-colors'
        : '';

    return (
        <div className={`rounded-2xl p-4 sm:p-6 ${LIGHT[tone]} shadow-sm ${pulseClass}`}>
            <div className="flex items-center gap-2 mb-4">
                <div className={`h-4 w-4 rounded-full ${DOT[tone]} flex-shrink-0`} />
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                    {title} <span className="text-gray-500 font-normal">({items.length})</span>
                </h3>
            </div>
            {items.length === 0 ? (
                <p className="text-xs sm:text-sm text-gray-600">No teams in this category.</p>
            ) : (
                <ul className="space-y-3 sm:space-y-4">
                    {items.map((t) => (
                        <li key={t.roster_id} className={`flex items-start gap-2 sm:gap-3 ${itemClass}`}>
                            {t.avatar ? (
                                <img
                                    src={t.avatar}
                                    alt="avatar"
                                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-gray-200 shadow-sm flex-shrink-0"
                                />
                            ) : (
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-200 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                                <div
                                    className="font-medium text-gray-900 truncate cursor-pointer hover:underline text-sm sm:text-base"
                                    onClick={() => onTeamClick(t)}
                                >
                                    {t.name}
                                </div>
                                {t.flagged?.length ? (
                                    <ul className="mt-1 text-xs text-gray-700 space-y-1">
                                        {t.flagged.map((f, i) => (
                                            <li key={i} className="flex items-start">
                                                <span className="mr-1.5">•</span>
                                                <span className="break-words">
                                                    {f.name || f.pid}{" "}
                                                    {f.reason ? <span className="text-gray-500">— {f.reason}</span> : null}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default StatusSection;

