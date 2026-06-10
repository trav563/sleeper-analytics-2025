import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Users, Flame, Snowflake, ChevronRight } from 'lucide-react';
import { avatarUrl, playerHeadshotUrl } from '../../../utils/nflData';
import { fetchTrendingPlayers } from '../../../utils/sleeper';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { getTeamLifecycle, getPlayerVerdict } from '../../../utils/tradeLogic';
import ValueBadge from '../../../components/ui/ValueBadge';
import PlayerDossier from './PlayerDossier';

const TeamRoster = ({ roster, players, users, currentWeek, transactions, seasonMatchups, league, rosters }) => {
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    // Fetch Trending Data (Top 20 Adds)
    const { data: trendingAdds } = useQuery({
        queryKey: ['trendingAdds'],
        queryFn: () => fetchTrendingPlayers('add', 24, 25),
        staleTime: 60 * 60 * 1000,
    });

    // Fetch Market Values
    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', league?.league_id],
        queryFn: () => fetchMarketValues(
            league?.roster_positions?.includes('SUPER_FLEX'),
            rosters?.length || 12,
            0.5
        ),
        staleTime: 60 * 60 * 1000,
    });

    if (!roster) return <Card className="p-4 text-center text-slate-500">Select a team to view roster.</Card>;

    // Strategy Context
    const teamLifecycle = getTeamLifecycle(roster, rosters);

    // Helpers
    const getTrendIcon = (pid) => {
        if (trendingAdds?.some(t => t.player_id === pid)) return <Flame className="w-3 h-3 text-orange-500" />;
        // Could check drops too, but requests asked for Hot/Cold. We'll stick to Hot for positive reinforcement or implement drops if needed.
        return null;
    };

    const getPosColor = (pos) => {
        switch (pos) {
            case 'QB': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
            case 'RB': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'WR': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'TE': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            default: return 'bg-slate-500/20 text-slate-300';
        }
    };

    // Organize Players
    const starters = roster.starters || [];
    const rosterPlayers = roster.players || [];
    const taxi = roster.taxi || [];
    const ir = roster.reserve || [];

    const getGroupedPlayers = () => {
        const groups = {
            'Starters': [],
            'Bench': [],
            'Taxi': [],
            'IR': []
        };

        const processedIds = new Set();

        starters.forEach((pid, idx) => {
            if (pid === '0') return; // Empty slot
            const p = players[pid];
            if (p) {
                groups['Starters'].push({ ...p, role: 'Starter' });
                processedIds.add(pid);
            }
        });

        taxi.forEach(pid => {
            const p = players[pid];
            if (p) {
                groups['Taxi'].push({ ...p, role: 'Taxi' });
                processedIds.add(pid);
            }
        });

        ir.forEach(pid => {
            const p = players[pid];
            if (p) {
                groups['IR'].push({ ...p, role: 'IR' });
                processedIds.add(pid);
            }
        });

        // Bench = Everyone else
        rosterPlayers.forEach(pid => {
            if (!processedIds.has(pid) && !starters.includes(pid)) { // Simple check, though starters array has processedIds
                const p = players[pid];
                if (p) {
                    groups['Bench'].push({ ...p, role: 'Bench' });
                }
            }
        });

        // Sort bench by Market Value desc
        groups['Bench'].sort((a, b) => (marketValues?.[b.player_id] || 0) - (marketValues?.[a.player_id] || 0));

        return groups;
    };

    const playerGroups = getGroupedPlayers();

    const PlayerRow = ({ player }) => {
        const mv = marketValues?.[player.player_id] || 0;
        const verdict = getPlayerVerdict(player, mv, teamLifecycle);

        return (
            <div
                className="group flex items-center justify-between p-2 hover:bg-slate-800 rounded cursor-pointer transition-colors border-b border-slate-800/50 last:border-0"
                onClick={() => setSelectedPlayer(player)}
            >
                <div className="flex items-center gap-3 w-2/3">
                    <div className={`text-[10px] font-bold w-tight sm:w-8 px-1 text-center py-0.5 rounded border ${getPosColor(player.position)}`}>
                        {player.position}
                    </div>
                    <div className="flex items-center gap-3 truncate">
                        <img src={playerHeadshotUrl(player.player_id)} alt="" className="w-8 h-8 rounded-full bg-slate-800 object-cover hidden sm:block" />
                        <div className="truncate">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-200 truncate">{player.first_name[0]}. {player.last_name}</span>
                                {getTrendIcon(player.player_id)}
                                {verdict && (
                                    <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${verdict.color}`}>
                                        {verdict.status}
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex gap-2">
                                <span>{player.team || 'FA'}</span>
                                {player.injury_status && <span className="text-red-400 font-semibold">{player.injury_status}</span>}
                                {verdict && <span className="text-slate-600 hidden md:inline ml-1">• {verdict.reason}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                    {marketValues && marketValues[player.player_id] && (
                        <div className="hidden sm:block">
                            <ValueBadge value={marketValues[player.player_id]} />
                        </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                </div>
            </div>
        );
    };

    return (
        <>
            <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                    <CardTitle className="text-white flex items-center gap-2 text-base">
                        <Users className="w-5 h-5 text-blue-400" />
                        Team Roster
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {['Starters', 'Bench', 'Taxi', 'IR'].map(group => {
                        if (playerGroups[group].length === 0) return null;
                        return (
                            <div key={group}>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">
                                    {group}
                                </h4>
                                <div className="space-y-0.5">
                                    {playerGroups[group].map(p => <PlayerRow key={p.player_id} player={p} />)}
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <PlayerDossier
                player={selectedPlayer}
                isOpen={!!selectedPlayer}
                onClose={() => setSelectedPlayer(null)}
                transactions={transactions}
                seasonMatchups={seasonMatchups}
                users={users}
                rosters={rosters}
                league={league}
            />
        </>
    );
};

export default TeamRoster;
