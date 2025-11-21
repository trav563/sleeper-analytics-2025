
import { isDSTStarterId, classifyInjury, POSITION_ORDER, STATUS_COLORS } from '../utils/nflData';

const TeamLineupModal = ({ team, matchup, players, onClose, byeTeamsThisWeek, rosterById, userById, league }) => {
    if (!team || !matchup) return null;

    const { TEXT } = STATUS_COLORS;

    // Use league's roster_positions if available, otherwise fall back to standard positions
    const rosterPositions = league?.roster_positions || ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "DEF", "K"];

    const starters = matchup.starters || [];
    const starterDetails = starters.map((pid, index) => {
        // Handle empty slots - assign position based on league's roster_positions
        if (!pid || pid === "" || pid === null || pid === undefined || pid === "0") {
            const position = index < rosterPositions.length ? rosterPositions[index] : "FLEX";
            return {
                pid: `empty - ${index} `,
                name: "EMPTY",
                position: position,
                status: "INCOMPLETE",
                reason: "Empty Slot",
                isEmpty: true
            };
        }

        // Handle D/ST separately
        if (isDSTStarterId(pid)) {
            const isDST = true;
            const onBye = byeTeamsThisWeek.has(pid);
            return {
                pid,
                name: `${pid} D / ST`,
                position: "DEF",
                status: onBye ? "INCOMPLETE" : "OK",
                reason: onBye ? "BYE" : "Active",
                isDST,
                isDefense: true
            };
        }

        const player = players[pid];
        if (!player) {
            const position = index < rosterPositions.length ? rosterPositions[index] : "FLEX";
            return { pid, name: "EMPTY", position: position, status: "INCOMPLETE", reason: "Empty Slot", isEmpty: true };
        }

        const fullName = `${player.first_name || ""} ${player.last_name || ""} `.trim();
        const position = player.position || (index < rosterPositions.length ? rosterPositions[index] : "FLEX");

        // Check for bye week
        const onBye = player.team && byeTeamsThisWeek.has(player.team);
        if (onBye) {
            return {
                pid,
                name: fullName,
                position,
                status: "INCOMPLETE",
                reason: "BYE"
            };
        }

        // Check injury status
        const status = classifyInjury(player);
        const reason = player.injury_status || player.status || (status === "INCOMPLETE" ? "Out" : null);

        // Explicitly check for PUP status
        const isPUP = (player.injury_status || "").toLowerCase() === "pup" ||
            (player.status || "").toLowerCase() === "pup";

        return {
            pid,
            name: fullName,
            position,
            status: isPUP ? "INCOMPLETE" : status,
            reason: isPUP ? "PUP" : reason
        };
    });

    // Sort by position order
    const sortedStarters = [...starterDetails].sort((a, b) => {
        const orderA = POSITION_ORDER[a.position] || 99;
        const orderB = POSITION_ORDER[b.position] || 99;
        return orderA - orderB;
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            {team.avatar ? (
                                <img src={team.avatar} alt="avatar" className="h-12 w-12 rounded-full border border-gray-200 shadow-sm" />
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-gray-200" />
                            )}
                            <h2 className="text-xl font-bold text-gray-900">{team.name}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <h3 className="font-semibold text-gray-700 mb-3">Starting Lineup</h3>

                    {/* Debug Info */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                        <div className="font-semibold text-blue-900 mb-1">Debug Info:</div>
                        <div className="text-blue-800">Roster ID: {team.roster_id}</div>
                        <div className="text-blue-800">Matchup ID: {matchup.matchup_id}</div>
                        <div className="text-blue-800">Starters Count: {starters.length}</div>
                        <div className="text-blue-800 font-mono text-[10px] break-all">
                            Player IDs: {JSON.stringify(starters)}
                        </div>
                    </div>

                    <ul className="space-y-2">
                        {sortedStarters.map((player) => (
                            <li key={player.pid} className="flex items-center p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                                <div className="w-10 text-xs font-medium text-gray-500">{player.position}</div>
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">{player.name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">ID: {player.pid}</div>
                                </div>
                                <div className={`text - sm font - medium ${player.reason === "PUP" || player.reason === "Empty Slot" ? TEXT.INCOMPLETE : TEXT[player.status]} `}>
                                    {player.reason === "Active" ? "Active" :
                                        player.reason ||
                                        (player.status === "OK" ? (player.position === "DEF" ? "Active" : "Healthy") : "")}
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-6 pt-4 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamLineupModal;
