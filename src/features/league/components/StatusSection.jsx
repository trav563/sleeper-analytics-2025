import { STATUS_COLORS } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';

const StatusSection = ({ title, items, tone, onTeamClick }) => {
    const { LIGHT, DOT, TEXT } = STATUS_COLORS;

    return (
        <section className={`rounded-xl p-4 shadow-card ${LIGHT[tone]}`}>
            <header className="flex items-center gap-2 mb-3">
                <span className={`h-2 w-2 rounded-full ${DOT[tone]} flex-shrink-0`} aria-hidden="true" />
                <h3 className="font-display text-md font-semibold text-text">
                    {title}
                </h3>
                <span className={`tnum text-xs font-mono ${TEXT[tone]} ml-auto`}>
                    {items.length}
                </span>
            </header>

            {items.length === 0 ? (
                <p className="text-sm text-text-dim">No teams in this category.</p>
            ) : (
                <ul className="space-y-2">
                    {items.map((t) => {
                        const seed = t.roster_id ?? t.name;
                        return (
                            <li
                                key={t.roster_id}
                                className="flex items-start gap-2.5 p-2 rounded-md hover:bg-bg-2/60 transition-colors duration-fast"
                            >
                                {t.avatar ? (
                                    <img
                                        src={t.avatar}
                                        alt=""
                                        className="h-9 w-9 rounded-full ring-1 ring-line flex-shrink-0"
                                    />
                                ) : (
                                    <Pip seed={seed} name={t.name} size={36} />
                                )}
                                <div className="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => onTeamClick(t)}
                                        className="block text-sm font-semibold text-text truncate hover:text-signal transition-colors duration-fast text-left"
                                    >
                                        {t.name}
                                    </button>
                                    {t.flagged?.length ? (
                                        <ul className="mt-1 text-xs text-text-dim space-y-0.5">
                                            {t.flagged.map((f, i) => (
                                                <li key={i} className="flex items-start">
                                                    <span className="mr-1.5 text-text-mute" aria-hidden="true">•</span>
                                                    <span className="break-words">
                                                        {f.name || f.pid}
                                                        {f.reason ? <span className="text-text-mute"> — {f.reason}</span> : null}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default StatusSection;
