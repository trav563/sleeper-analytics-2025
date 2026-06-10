import { useMemo } from 'react';
import { Target, Star, TrendingUp, ArrowUpRight } from 'lucide-react';
import { getBestAvailable, getPositionValueMultiplier, analyzeRosterNeeds, getPositionColor } from '../../../utils/draftEngine';
import { playerHeadshotUrl } from '../../../utils/nflData';

const TAG_CONFIG = {
    NEED:  { icon: Target,      label: 'NEED',  color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    BPA:   { icon: Star,        label: 'BPA',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    VALUE: { icon: TrendingUp,  label: 'VALUE', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

/**
 * RecommendationsPanel — Best available players adjusted by league settings and team needs.
 */
const RecommendationsPanel = ({ league, players = {}, draftedPlayerIds, marketValues = {}, userPicks = [], existingRoster = [] }) => {
    const recommendations = useMemo(() => {
        if (!league || !players || !draftedPlayerIds || !Object.keys(marketValues).length) return [];

        const rosterPositions = league.roster_positions || [];
        const scoringSettings = league.scoring_settings || {};

        // 1. Get position multipliers for this league
        const multipliers = getPositionValueMultiplier(scoringSettings, rosterPositions);

        // 2. Get team needs
        const { needs } = analyzeRosterNeeds(rosterPositions, userPicks, players, existingRoster);

        // 3. Get best available
        return getBestAvailable(players, draftedPlayerIds, marketValues, multipliers, needs, 12);
    }, [league, players, draftedPlayerIds, marketValues, userPicks, existingRoster]);

    if (recommendations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Target className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Waiting for draft data...</p>
                <p className="text-xs text-slate-600 mt-1">Recommendations appear once market values load</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Recommended Picks
                </span>
                <span className="text-slate-600 normal-case tracking-normal">Adj. by league settings</span>
            </div>

            {/* Legend */}
            <div className="flex gap-2 mb-3">
                {Object.entries(TAG_CONFIG).map(([key, config]) => (
                    <span key={key} className={`flex items-center gap-1 text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${config.color}`}>
                        <config.icon className="w-2.5 h-2.5" />
                        {config.label}
                    </span>
                ))}
            </div>

            {/* Recommendations List */}
            <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '420px' }}>
                {recommendations.map((rec, idx) => {
                    const tagConfig = TAG_CONFIG[rec.tag] || TAG_CONFIG.BPA;
                    const posColor = getPositionColor(rec.position);
                    const TagIcon = tagConfig.icon;

                    return (
                        <div
                            key={rec.player_id}
                            className={`group flex items-center gap-2.5 p-2.5 rounded-lg border transition-all hover:border-slate-500/60 ${
                                idx === 0 
                                    ? 'bg-gradient-to-r from-slate-800/80 to-slate-800/40 border-slate-600/50 shadow-sm' 
                                    : 'bg-slate-800/40 border-slate-700/30'
                            }`}
                        >
                            {/* Rank */}
                            <div className={`text-xs font-bold w-5 text-center shrink-0 ${
                                idx === 0 ? 'text-amber-400' : idx < 3 ? 'text-slate-300' : 'text-slate-500'
                            }`}>
                                {idx + 1}
                            </div>

                            {/* Player Photo */}
                            <div className="relative shrink-0">
                                <img
                                    src={playerHeadshotUrl(rec.player_id)}
                                    alt=""
                                    className="w-9 h-9 rounded-full object-cover bg-slate-700 border border-slate-600"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${posColor.dot} flex items-center justify-center shadow-sm`}>
                                    <span className="text-[7px] font-black text-white">{rec.position.charAt(0)}</span>
                                </div>
                            </div>

                            {/* Player Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold text-slate-200 truncate">{rec.name}</p>
                                    {idx === 0 && <ArrowUpRight className="w-3 h-3 text-amber-400 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[9px] font-bold px-1 py-0 rounded ${posColor.bg} ${posColor.text}`}>
                                        {rec.position}
                                    </span>
                                    <span className="text-[10px] text-slate-500">{rec.team}</span>
                                    {rec.age && <span className="text-[10px] text-slate-600">Age {rec.age}</span>}
                                </div>
                            </div>

                            {/* Value + Tag */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-mono text-slate-500">{rec.value.toLocaleString()}</span>
                                    {rec.positionMultiplier > 1.1 && (
                                        <span className="text-[8px] text-purple-400 font-bold">×{rec.positionMultiplier.toFixed(1)}</span>
                                    )}
                                </div>
                                <span className={`flex items-center gap-0.5 text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${tagConfig.color}`}>
                                    <TagIcon className="w-2.5 h-2.5" />
                                    {tagConfig.label}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RecommendationsPanel;
