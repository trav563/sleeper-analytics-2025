import { Trophy, Users, Calendar, Settings } from 'lucide-react';

const LeagueCard = ({ league, onClick }) => {
    const { name, season, total_rosters, scoring_settings, avatar } = league;

    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            onClick={() => onClick?.(league)}
            className="w-full text-left bg-bg-1 rounded-xl p-5 border border-line shadow-card hover:border-line-strong transition-colors duration-fast group"
        >
            <div className="flex items-start gap-4 mb-4">
                {avatar ? (
                    <img
                        src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
                        alt=""
                        className="w-12 h-12 rounded-lg ring-1 ring-line"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-lg bg-bg-2 flex items-center justify-center ring-1 ring-line">
                        <Trophy className="w-6 h-6 text-text-dim" />
                    </div>
                )}
                <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold text-text truncate group-hover:text-signal transition-colors duration-fast">
                        {name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-text-dim text-xs mt-1">
                        <Calendar className="w-3 h-3" />
                        <span className="font-mono tnum">{season}</span>
                        <span className="text-text-mute">Season</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg-2 rounded-md p-2.5 border border-line">
                    <div className="flex items-center gap-1.5 text-text-mute font-mono text-2xs uppercase tracking-wider mb-1">
                        <Users className="w-3 h-3" />
                        <span>Teams</span>
                    </div>
                    <span className="tnum text-text font-semibold text-md">{total_rosters}</span>
                </div>

                <div className="bg-bg-2 rounded-md p-2.5 border border-line">
                    <div className="flex items-center gap-1.5 text-text-mute font-mono text-2xs uppercase tracking-wider mb-1">
                        <Settings className="w-3 h-3" />
                        <span>Format</span>
                    </div>
                    <span className="text-text font-semibold text-md">
                        {scoring_settings?.rec ? 'PPR' : 'Std'}
                        {scoring_settings?.rec === 0.5 ? ' (Half)' : ''}
                    </span>
                </div>
            </div>
        </Tag>
    );
};

export default LeagueCard;
