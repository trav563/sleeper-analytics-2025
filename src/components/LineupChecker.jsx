import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLeagueData } from '../hooks/useLeagueData';
import { isDSTStarterId, classifyInjury, displayTeamName, avatarUrl } from '../utils/nflData';
import { getTeamsOnBye } from '../services/nflSchedule';
import StatusSection from './StatusSection';
import TeamLineupModal from './TeamLineupModal';

const LineupChecker = ({ leagueId }) => {
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedMatchup, setSelectedMatchup] = useState(null);

    const { state, users, rosters, matchups, players, league, loading, error, refresh } = useLeagueData(leagueId);

    const week = state?.display_week || state?.week || state?.leg;
    const seasonType = state?.season_type || "regular";
    const isPreseason = seasonType === "pre";

    // Fetch dynamic bye weeks from ESPN API
    const [byeTeamsThisWeek, setByeTeamsThisWeek] = useState(new Set());

    useEffect(() => {
        let mounted = true;

        const fetchByes = async () => {
            if (!week) return;
            const teams = await getTeamsOnBye(week);
            if (mounted) {
                setByeTeamsThisWeek(new Set(teams));
            }
        };

        fetchByes();

        return () => {
            mounted = false;
        };
    }, [week]);

    const userById = useMemo(() => new Map(users.map((u) => [u.user_id, u])), [users]);
    const rosterById = useMemo(() => new Map(rosters.map((r) => [r.roster_id, r])), [rosters]);

    const teams = useMemo(() => {
        if (!players) return [];
        const out = [];

        for (const m of matchups) {
            const roster = rosterById.get(m.roster_id);
            const owner = userById.get(roster?.owner_id);

            // Use matchup.starters as primary source for week-specific lineup
            // Fallback to roster.starters only if matchup is missing
            const rawStarters = (m.starters || roster?.starters || []);
            const starters = rawStarters.filter(Boolean); // Filter out empty slots for processing

            const hasEmptySlots = rawStarters.some(pid => !pid || pid === "" || pid === null || pid === undefined || pid === "0");

            let status = hasEmptySlots ? "INCOMPLETE" : "OK";
            const flagged = [];

            if (hasEmptySlots) {
                flagged.push({ pid: "empty", name: "Empty Slot", reason: "Empty Slot" });
            }

            if (!hasEmptySlots) {
                const nonEmptyStarters = starters.filter(Boolean);

                for (const pid of nonEmptyStarters) {
                    if (isDSTStarterId(pid)) {
                        if (byeTeamsThisWeek.has(pid)) {
                            status = "INCOMPLETE";
                            flagged.push({ pid, name: `${pid} D/ST`, reason: "BYE" });
                            break;
                        }
                        continue;
                    }

                    const p = players[pid];
                    if (!p) continue;

                    const team = p.team;
                    if (team && byeTeamsThisWeek.has(team)) {
                        status = "INCOMPLETE";
                        flagged.push({ pid, name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: "BYE" });
                        break;
                    }

                    const isPUP = (p.injury_status || "").toLowerCase() === "pup" ||
                        (p.status || "").toLowerCase() === "pup";

                    if (isPUP) {
                        status = "INCOMPLETE";
                        flagged.push({ pid, name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: "PUP" });
                        break;
                    }

                    const bucket = classifyInjury(p);
                    if (bucket === "INCOMPLETE") {
                        status = "INCOMPLETE";
                        flagged.push({ pid, name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: (p.injury_status || p.status || "Out").toString() });
                        break;
                    } else if (bucket === "POTENTIAL" && status !== "INCOMPLETE") {
                        status = "POTENTIAL";
                        flagged.push({ pid, name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: p.injury_status || "Questionable" });
                    }
                }
            }

            out.push({
                roster_id: m.roster_id,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar || null, "thumbs"),
                status,
                flagged,
                matchup_id: m.matchup_id,
            });
        }

        return out;
    }, [matchups, players, rosterById, userById, byeTeamsThisWeek]);

    const grouped = useMemo(() => {
        const g = { OK: [], POTENTIAL: [], INCOMPLETE: [] };
        for (const t of teams) g[t.status].push(t);
        return g;
    }, [teams]);

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
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Lineup Completeness</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        {isPreseason ? "Preseason " : ""}Week {week ?? "-"}
                    </p>
                </div>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`lucide lucide-refresh-cw ${loading ? 'animate-spin' : ''}`}
                    >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M8 16H3v5" />
                    </svg>
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            )}

            {error && (
                <div className="p-4 rounded-md bg-red-900/50 border border-red-800 text-red-200">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div className="text-xs text-gray-500 pt-4 border-t border-gray-800">
                <p>
                    Injury data and rosters via Sleeper public API. Team BYEs are fetched dynamically from ESPN.
                </p>
            </div>
        </div>
    );
};

export default LineupChecker;
