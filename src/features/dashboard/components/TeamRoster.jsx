import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Flame, ChevronRight } from 'lucide-react';
import { playerHeadshotUrl } from '../../../utils/nflData';
import { fetchTrendingPlayers } from '../../../utils/sleeper';
import { fetchMarketValues } from '../../../utils/fantasyCalc';

// Position chips repointed to broadcast tokens
const POS_TONE = {
    QB:  'bg-bad/15 text-bad border-bad/30',
    RB:  'bg-good/15 text-good border-good/30',
    WR:  'bg-signal/15 text-signal border-signal/30',
    TE:  'bg-signal-2/15 text-signal-2 border-signal-2/30',
    K:   'bg-warn/15 text-warn border-warn/30',
    DEF: 'bg-bg-3 text-text-dim border-line',
};
const defaultPosTone = 'bg-bg-3 text-text-dim border-line';

const TeamRoster = ({ roster, players, league, rosters }) => {
    const navigate = useNavigate();

    const { data: trendingAdds } = useQuery({
        queryKey: ['trendingAdds'],
        queryFn: () => fetchTrendingPlayers('add', 24, 25),
        staleTime: 60 * 60 * 1000,
    });

    const { data: marketValues } = useQuery({
        queryKey: ['fantasyCalc', league?.league_id],
        queryFn: () => fetchMarketValues(
            league?.roster_positions?.includes('SUPER_FLEX'),
            rosters?.length || 12,
            0.5
        ),
        staleTime: 60 * 60 * 1000,
    });

    if (!roster) {
        return (
            <section className="bg-bg-1 rounded-xl border border-line p-4 shadow-card text-center font-mono text-2xs uppercase tracking-wider text-text-mute">
                Select a team to view roster
            </section>
        );
    }

    const isTrending = (pid) => trendingAdds?.some(t => t.player_id === pid);

    const starters = roster.starters || [];
    const rosterPlayers = roster.players || [];
    const taxi = roster.taxi || [];
    const ir = roster.reserve || [];

    const getGroupedPlayers = () => {
        const groups = { Starters: [], Bench: [], Taxi: [], IR: [] };
        const processedIds = new Set();

        starters.forEach((pid) => {
            if (pid === '0') return;
            const p = players[pid];
            if (p) { groups.Starters.push({ ...p, role: 'Starter' }); processedIds.add(pid); }
        });

        taxi.forEach(pid => {
            const p = players[pid];
            if (p) { groups.Taxi.push({ ...p, role: 'Taxi' }); processedIds.add(pid); }
        });

        ir.forEach(pid => {
            const p = players[pid];
            if (p) { groups.IR.push({ ...p, role: 'IR' }); processedIds.add(pid); }
        });

        rosterPlayers.forEach(pid => {
            if (!processedIds.has(pid) && !starters.includes(pid)) {
                const p = players[pid];
                if (p) groups.Bench.push({ ...p, role: 'Bench' });
            }
        });

        groups.Bench.sort((a, b) => (marketValues?.[b.player_id] || 0) - (marketValues?.[a.player_id] || 0));
        return groups;
    };

    const playerGroups = getGroupedPlayers();

    const PlayerRow = ({ player }) => (
        <button
            type="button"
            onClick={() => navigate(`/league/${league.league_id}/player/${player.player_id}`)}
            className="group w-full flex items-center justify-between gap-3 p-2 hover:bg-bg-2 rounded-md transition-colors duration-fast border-b border-line/30 last:border-0 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={`font-mono text-2xs font-bold w-9 text-center py-0.5 rounded-sm border uppercase tracking-wider ${POS_TONE[player.position] || defaultPosTone}`}>
                    {player.position}
                </div>
                <img
                    src={playerHeadshotUrl(player.player_id)}
                    alt=""
                    className="w-8 h-8 rounded-full bg-bg-3 object-cover ring-1 ring-line shrink-0"
                    onError={(e) => { e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'; }}
                />
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-text truncate">{player.first_name[0]}. {player.last_name}</span>
                        {isTrending(player.player_id) && (
                            <Flame className="w-3 h-3 text-signal-2 shrink-0" aria-label="Trending" />
                        )}
                    </div>
                    <div className="font-mono text-2xs text-text-mute mt-0.5 flex gap-1.5 uppercase tracking-wider">
                        <span>{player.team || 'FA'}</span>
                        {player.injury_status && (
                            <span className="text-bad font-bold">{player.injury_status}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                {marketValues && marketValues[player.player_id] && (
                    <div className="hidden sm:block text-right">
                        <p className="font-mono text-2xs text-text-mute uppercase tracking-wider">Value</p>
                        <p className="font-mono text-xs text-signal-2 tnum">{marketValues[player.player_id].toLocaleString()}</p>
                    </div>
                )}
                <ChevronRight className="w-4 h-4 text-text-mute group-hover:text-signal transition-colors duration-fast" aria-hidden="true" />
            </div>
        </button>
    );

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card">
            <header className="px-4 pt-3 pb-2 border-b border-line flex items-center gap-2">
                <Users className="w-4 h-4 text-signal" aria-hidden="true" />
                <h3 className="font-display text-md font-semibold text-text">Team Roster</h3>
            </header>
            <div className="px-4 py-4 space-y-5">
                {['Starters', 'Bench', 'Taxi', 'IR'].map(group => {
                    if (playerGroups[group].length === 0) return null;
                    return (
                        <div key={group}>
                            <h4 className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-2 border-b border-line pb-1">
                                {group}
                            </h4>
                            <div className="space-y-0.5">
                                {playerGroups[group].map(p => <PlayerRow key={p.player_id} player={p} />)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default TeamRoster;
