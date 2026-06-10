import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { displayTeamName } from '../../../utils/nflData';
import { Trophy, CalendarClock, ArrowUpRight, Target } from 'lucide-react';
import ValueBadge from '../../../components/ui/ValueBadge';
import { Card, CardContent } from '../../../components/ui/Card';

const getLeaguePicks = (rosters, league, tradedPicks) => {
    if (!rosters || !league) return [];
    
    const currentYear = parseInt(league.season);
    const sortedRosters = [...rosters].sort((a, b) => (b.settings?.ppts || 0) - (a.settings?.ppts || 0)); 
    
    let allLeaguePicks = [];
    rosters.forEach(r => {
        [currentYear + 1, currentYear + 2, currentYear + 3].forEach(year => {
            [1, 2, 3].forEach(round => {
                allLeaguePicks.push({
                    id: `pick-${year}-${round}-${r.roster_id}`,
                    year,
                    round,
                    original_owner_id: r.roster_id,
                    roster_id: r.roster_id, // current owner defaults to original
                    type: 'Pick'
                });
            });
        });
    });

    // Apply specific trade ledger
    if (tradedPicks) {
        tradedPicks.forEach(tp => {
            const year = parseInt(tp.season);
            const match = allLeaguePicks.find(p =>
                p.year === year &&
                p.round === tp.round &&
                p.original_owner_id === tp.roster_id
            );
            if (match) {
                match.roster_id = tp.owner_id;
            }
        });
    }

    // Value Estimates
    const totalTeams = rosters.length;
    allLeaguePicks.forEach(p => {
        const originalOwnerIdx = sortedRosters.findIndex(r => r.roster_id === p.original_owner_id);
        const rank = originalOwnerIdx !== -1 ? (totalTeams - originalOwnerIdx) : Math.floor(totalTeams/2);

        let val = 150;
        if (p.round === 1) {
            if (rank <= 3) val = 7000;
            else if (rank <= 8) val = 5500;
            else val = 4500;
        } else if (p.round === 2) {
            if (rank <= 4) val = 2800;
            else if (rank <= 8) val = 2200;
            else val = 1600;
        } else if (p.round === 3) {
            val = 600;
        }

        p.tradeValue = val;
        let qual = 'Mid';
        if (rank <= 4) qual = 'Early';
        else if (rank >= 9) qual = 'Late';

        p.full_name = `${p.year} ${p.round === 1 ? '1st' : p.round === 2 ? '2nd' : '3rd'}`;
        p.qualifier = p.year === currentYear + 1 ? qual : 'Proj';
    });

    return allLeaguePicks;
};

const DraftCapitalRow = ({ roster, index, picks, users }) => {
    const user = users.find(u => u.user_id === roster.owner_id);
    const totalValue = picks.reduce((sum, p) => sum + p.tradeValue, 0);

    // Group picks by year
    const picksByYear = picks.reduce((acc, pick) => {
        if (!acc[pick.year]) acc[pick.year] = [];
        acc[pick.year].push(pick);
        return acc;
    }, {});

    const maxPicks = Math.max(...Object.values(picksByYear).map(arr => arr.length), 1);

    return (
        <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors w-full overflow-hidden relative group">
            {/* Rank Gradient Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${index === 0 ? 'bg-gradient-to-b from-amber-300 to-amber-600' : index < 3 ? 'bg-slate-400' : 'bg-slate-800'}`}></div>
            
            <CardContent className="p-0 sm:p-0">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
                    
                    {/* Team Info Container */}
                    <div className="w-full md:w-[35%] lg:w-[30%] p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                {user?.avatar ? (
                                    <img 
                                        src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`} 
                                        className="w-12 h-12 rounded border border-slate-700 shadow-sm object-cover" 
                                        alt={user?.display_name} 
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                                        <Trophy className="w-6 h-6 text-slate-500" />
                                    </div>
                                )}
                                <div className="absolute -top-2 -left-2 bg-slate-800 text-slate-300 text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-slate-700">
                                    {index + 1}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-100 flex items-center gap-2">
                                    {displayTeamName(user)}
                                    {index === 0 && <span className="text-[9px] uppercase tracking-wider bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">The Bank</span>}
                                </span>
                                <span className="text-xs text-slate-500 font-mono mt-0.5">{totalValue.toLocaleString()} Capital Value</span>
                            </div>
                        </div>
                    </div>

                    {/* Picks Container */}
                    <div className="w-full md:w-[65%] lg:w-[70%] p-4 bg-slate-900/50">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {Object.keys(picksByYear).sort().map(year => (
                                <div key={year} className="flex flex-col space-y-2">
                                    <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800 pb-1 mb-1">
                                        {year} Class
                                    </h4>
                                    <div className="flex flex-col gap-1.5">
                                        {picksByYear[year].sort((a,b) => a.round - b.round || b.tradeValue - a.tradeValue).map(pick => (
                                            <div key={pick.id} className="flex items-center justify-between bg-slate-800/80 rounded border border-slate-700/50 px-2 py-1.5 min-h-[36px]">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${pick.round === 1 ? 'bg-purple-500' : pick.round === 2 ? 'bg-blue-500' : 'bg-slate-500'}`}></span>
                                                    <span className="text-xs font-medium text-slate-300">
                                                        Round {pick.round}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] text-slate-500">{pick.qualifier}</span>
                                                    <span className="text-[10px] font-mono text-emerald-400/80">{pick.tradeValue.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};

const DraftCapital = ({ league, rosters, users, state, tradedPicks }) => {
    // Determine league size and fetching context
    const isSuperflex = league?.roster_positions?.includes('SUPER_FLEX');
    const numTeams = users?.length || 12;

    const { data: marketValues, isLoading: loadingValues } = useQuery({
        queryKey: ['marketValues', isSuperflex, numTeams],
        queryFn: () => fetchMarketValues(isSuperflex, numTeams, 0.5),
        staleTime: 60 * 60 * 1000 // 1 hour
    });

    const allPicks = useMemo(() => getLeaguePicks(rosters, league, tradedPicks), [rosters, league, tradedPicks]);

    const teamCapital = useMemo(() => {
        if (!allPicks.length || !rosters) return [];

        return rosters.map(roster => {
            const picks = allPicks.filter(p => p.roster_id === roster.roster_id);
            const totalValue = picks.reduce((sum, p) => sum + p.tradeValue, 0);
            return {
                roster,
                picks,
                totalValue
            };
        }).sort((a, b) => b.totalValue - a.totalValue);
    }, [allPicks, rosters]);

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-l-4 border-l-blue-500 rounded-lg p-6 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
                <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                        <Target className="w-5 h-5 text-blue-400" />
                        Power Rankings by Draft Capital
                    </h3>
                    <p className="text-sm text-slate-400">
                        Tracks all future draft picks owned by each franchise for the next three seasons, ranked by total market value estimated via FantasyCalc.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {teamCapital.map((team, idx) => (
                    <DraftCapitalRow 
                        key={team.roster.roster_id} 
                        index={idx} 
                        roster={team.roster} 
                        picks={team.picks} 
                        users={users} 
                    />
                ))}
            </div>
        </div>
    );
};

export default DraftCapital;
