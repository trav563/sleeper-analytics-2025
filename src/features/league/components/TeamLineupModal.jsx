import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { classifyInjury, isDSTStarterId } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';

const STATUS_TONE = {
    OK: 'text-good',
    INCOMPLETE: 'text-bad',
    POTENTIAL: 'text-warn',
    PUP: 'text-warn',
    OUT: 'text-bad',
    QUESTIONABLE: 'text-warn',
    DOUBTFUL: 'text-bad',
};

const POSITION_ORDER = {
    QB: 1, RB: 2, WR: 3, TE: 4, FLEX: 5, DEF: 6, K: 7,
};

const TeamLineupModal = ({ team, matchup, players, onClose, byeTeamsThisWeek, league }) => {
    const closeRef = useRef(null);

    // Escape-to-close + move focus into the dialog on open. Guarded inside the
    // effect (not via early return) so hook order stays stable.
    useEffect(() => {
        if (!team || !matchup) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        closeRef.current?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [team, matchup, onClose]);

    if (!team || !matchup) return null;

    // Use league's roster_positions if available, otherwise fall back to standard positions
    const rosterPositions = league?.roster_positions || ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "DEF", "K"];

    const starters = matchup.starters || [];
    const starterDetails = starters.map((pid, index) => {
        // Handle empty slots - assign position based on league's roster_positions
        if (!pid || pid === "" || pid === null || pid === undefined || pid === "0") {
            const position = index < rosterPositions.length ? rosterPositions[index] : "FLEX";
            return {
                pid: `empty-${index}`,
                name: "EMPTY",
                position,
                status: "INCOMPLETE",
                reason: "Empty Slot",
                isEmpty: true,
            };
        }

        // Handle D/ST separately
        if (isDSTStarterId(pid)) {
            const onBye = byeTeamsThisWeek.has(pid);
            return {
                pid,
                name: `${pid} D/ST`,
                position: "DEF",
                status: onBye ? "INCOMPLETE" : "OK",
                reason: onBye ? "BYE" : "Active",
                isDST: true,
                isDefense: true,
            };
        }

        const player = players[pid];
        if (!player) {
            const position = index < rosterPositions.length ? rosterPositions[index] : "FLEX";
            return { pid, name: "EMPTY", position, status: "INCOMPLETE", reason: "Empty Slot", isEmpty: true };
        }

        const fullName = `${player.first_name || ""} ${player.last_name || ""}`.trim();
        const position = player.position || (index < rosterPositions.length ? rosterPositions[index] : "FLEX");

        // Check for bye week
        const onBye = player.team && byeTeamsThisWeek.has(player.team);
        if (onBye) {
            return { pid, name: fullName, position, status: "INCOMPLETE", reason: "BYE" };
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
            reason: isPUP ? "PUP" : reason,
        };
    });

    // Sort by position order
    const sortedStarters = [...starterDetails].sort((a, b) => {
        const orderA = POSITION_ORDER[a.position] || 99;
        const orderB = POSITION_ORDER[b.position] || 99;
        return orderA - orderB;
    });

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lineup-modal-title"
        >
            <div
                className="bg-bg-1 rounded-xl shadow-pop max-w-lg w-full max-h-[90vh] overflow-y-auto border border-line"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5">
                    <header className="flex justify-between items-center gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {team.avatar ? (
                                <img
                                    src={team.avatar}
                                    alt=""
                                    className="h-12 w-12 rounded-full ring-1 ring-line flex-shrink-0"
                                />
                            ) : (
                                <Pip seed={team.roster_id ?? team.name} name={team.name} size={48} />
                            )}
                            <div className="min-w-0">
                                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                                    Starting Lineup
                                </div>
                                <h2 id="lineup-modal-title" className="font-display text-lg font-bold text-text truncate">{team.name}</h2>
                            </div>
                        </div>
                        <button
                            ref={closeRef}
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-bg-2 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </header>

                    <ul className="space-y-1.5">
                        {sortedStarters.map((player) => {
                            const tone = player.reason === "PUP" || player.reason === "Empty Slot"
                                ? STATUS_TONE.INCOMPLETE
                                : STATUS_TONE[player.status] || 'text-text-dim';
                            const reasonLabel = player.reason === "Active"
                                ? "Active"
                                : (player.reason || (player.status === "OK" ? (player.position === "DEF" ? "Active" : "Healthy") : ""));
                            return (
                                <li
                                    key={player.pid}
                                    className="grid items-center gap-3 p-2.5 rounded-md border border-line bg-bg-2/40 hover:bg-bg-2 transition-colors duration-fast"
                                    style={{ gridTemplateColumns: '40px 1fr auto' }}
                                >
                                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute font-bold">
                                        {player.position}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-text truncate">{player.name}</div>
                                        <div className="font-mono text-2xs text-text-mute truncate">ID: {player.pid}</div>
                                    </div>
                                    <span className={`text-xs font-semibold ${tone} text-right`}>
                                        {reasonLabel}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="mt-5 pt-4 border-t border-line">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full min-h-[44px] py-2 px-4 rounded-md bg-bg-2 hover:bg-bg-3 text-text font-semibold text-sm border border-line transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
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
