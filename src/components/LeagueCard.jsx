import { Trophy, Users, Calendar, Settings } from 'lucide-react';

const LeagueCard = ({ league, onClick }) => {
    const { name, season, total_rosters, scoring_settings, avatar } = league;

    return (
        <div
            onClick={() => onClick(league)}
            className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer group"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                    {avatar ? (
                        <img
                            src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
                            alt={name}
                            className="w-12 h-12 rounded-lg border border-slate-600"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center border border-slate-600">
                            <Trophy className="w-6 h-6 text-slate-400" />
                        </div>
                    )}
                    <div>
                        <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors line-clamp-1">
                            {name}
                        </h3>
                        <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>{season} Season</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                        <Users className="w-3 h-3" />
                        <span>Teams</span>
                    </div>
                    <span className="text-white font-medium">{total_rosters}</span>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                        <Settings className="w-3 h-3" />
                        <span>Format</span>
                    </div>
                    <span className="text-white font-medium">
                        {scoring_settings?.rec ? 'PPR' : 'Std'}
                        {scoring_settings?.rec === 0.5 ? ' (Half)' : ''}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default LeagueCard;
