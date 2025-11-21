import { useState, useEffect, useMemo } from 'react';
import { getTeamsOnBye } from '../../../services/nflSchedule';
import { isDSTStarterId, classifyInjury, displayTeamName, avatarUrl } from '../../../utils/nflData';

export function useLineupStatus(week, users, rosters, matchups, players) {
    const [byeTeamsThisWeek, setByeTeamsThisWeek] = useState(new Set());

    // Fetch dynamic bye weeks
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
        if (!players || !matchups || matchups.length === 0) return [];
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

    return {
        teams,
        grouped,
        byeTeamsThisWeek,
        userById,
        rosterById
    };
}
