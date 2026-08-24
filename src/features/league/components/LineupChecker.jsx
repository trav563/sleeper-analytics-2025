import { useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useLeagueData } from '../hooks/useLeagueData';
import { useLineupStatus } from '../hooks/useLineupStatus';
import { deriveCurrentWeek } from '../../../utils/seasonState';
import StatusSection from './StatusSection';
import TeamLineupModal from './TeamLineupModal';

const LineupChecker = ({ leagueId }) => {
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedMatchup, setSelectedMatchup] = useState(null);

    const { state, users, rosters, matchups, players, league, loading, error, refresh } = useLeagueData(leagueId);

    const week = deriveCurrentWeek(league, state);
    const seasonType = state?.season_type || "regular";
    const isPreseason = seasonType === "pre";

    const { grouped, byeTeamsThisWeek, userById, rosterById } = useLineupStatus(week, users, rosters, matchups, players);

    const getMatchupForTeam = useCallback((team) => {
        if (!team || !matchups) return null;
        return matchups.find(m => m.roster_id === team.roster_id);
    }, [matchups]);

    const handleTeamClick = useCallback((team) => {
        const matchup = getMatchupForTeam(team);
        setSelectedTeam(team);
        setSelectedMatchup(matchup);
    }, [getMatchupForTeam]);

    const handleCloseModal = useCallback(() => {
        setSelectedTeam(null);
        setSelectedMatchup(null);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                        {isPreseason ? "Preseason" : "Regular Season"} · Week <span className="tnum text-text-dim">{week ?? "—"}</span>
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold tracking-snug text-text">
                        Lineup Completeness
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-md bg-bg-2 hover:bg-bg-3 text-text border border-line text-sm font-semibold transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-12">
                    <div className="h-10 w-10 rounded-full border-2 border-line border-t-signal animate-spin" />
                </div>
            )}

            {error && (
                <div className="p-3 rounded-md bg-bad/10 border border-bad/30 text-bad text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatusSection title="Complete" items={grouped.OK} tone="OK" onTeamClick={handleTeamClick} />
                    <StatusSection title="Potential Issues" items={grouped.POTENTIAL} tone="POTENTIAL" onTeamClick={handleTeamClick} />
                    <StatusSection title="Incomplete" items={grouped.INCOMPLETE} tone="INCOMPLETE" onTeamClick={handleTeamClick} />
                </div>
            )}

            {selectedTeam && selectedMatchup && (
                <TeamLineupModal
                    team={selectedTeam}
                    matchup={selectedMatchup}
                    players={players}
                    byeTeamsThisWeek={byeTeamsThisWeek}
                    league={league}
                    rosterById={rosterById}
                    userById={userById}
                    onClose={handleCloseModal}
                />
            )}

            <div className="text-2xs font-mono uppercase tracking-wider text-text-mute pt-4 border-t border-line">
                Injury data and rosters via Sleeper public API. Team byes fetched from ESPN.
            </div>
        </div>
    );
};

export default LineupChecker;
