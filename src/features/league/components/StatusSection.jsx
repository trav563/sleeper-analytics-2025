import { STATUS_COLORS } from '../../../utils/nflData';
import { avatarUrl } from '../../../utils/nflData';

const StatusSection = ({ title, items, tone, onTeamClick }) => {
    const { LIGHT, DOT } = STATUS_COLORS;

    // Add pulse animation class for incomplete items
    // const pulseClass = tone === 'INCOMPLETE' ? 'animate-pulse' : ''; // Removed per user request
    const itemClass = tone === 'INCOMPLETE'
        ? 'bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 hover:bg-rose-500/20 transition-colors'
        : '';

    return (
        <div className={`rounded-2xl p-4 sm:p-6 ${LIGHT[tone]} shadow-sm`}>
            <div className="flex items-center gap-2 mb-4">
                <div className={`h-4 w-4 rounded-full ${DOT[tone]} flex-shrink-0`} />
                <h3 className="font-semibold text-white text-sm sm:text-base">
                    {title} <span className="text-slate-400 font-normal">({items.length})</span>
                </h3>
            </div>
            {items.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-400">No teams in this category.</p>
            ) : (
                <ul className="space-y-3 sm:space-y-4">
                    {items.map((t) => (
                        <li key={t.roster_id} className={`flex items-start gap-2 sm:gap-3 ${itemClass}`}>
                            {t.avatar ? (
                                <img
                                    src={t.avatar}
                                    alt="avatar"
                                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-slate-600 shadow-sm flex-shrink-0"
                                />
                            ) : (
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-slate-700 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                                <div
                                    className="font-medium text-white truncate cursor-pointer hover:underline text-sm sm:text-base"
                                    onClick={() => onTeamClick(t)}
                                >
                                    {t.name}
                                </div>
                                {t.flagged?.length ? (
                                    <ul className="mt-1 text-xs text-slate-300 space-y-1">
                                        {t.flagged.map((f, i) => (
                                            <li key={i} className="flex items-start">
                                                <span className="mr-1.5">•</span>
                                                <span className="break-words">
                                                    {f.name || f.pid}{" "}
                                                    {f.reason ? <span className="text-slate-400">— {f.reason}</span> : null}
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

