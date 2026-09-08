import { useState, useEffect, useMemo } from 'react';
import { getTeamsOnBye, getGameWeather } from '../../../services/nflSchedule';
import { isDSTStarterId, classifyInjury, displayTeamName, avatarUrl } from '../../../utils/nflData';

export function useLineupStatus(week, users, rosters, matchups, players, season) {
    const [byeTeamsThisWeek, setByeTeamsThisWeek] = useState(new Set());
    // getTeamsOnBye returns null when it can't determine byes. Tracked so the
    // UI can say so, rather than reporting lineups clean on missing data.
    const [byesUnavailable, setByesUnavailable] = useState(false);
    const [weatherData, setWeatherData] = useState({});

    // Fetch dynamic bye weeks + weather
    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            if (!week) return;
            const [teams, weather] = await Promise.all([
                getTeamsOnBye(week, season),
                getGameWeather(week).catch(() => ({})),
            ]);
            if (mounted) {
                setByeTeamsThisWeek(new Set(teams || []));
                setByesUnavailable(teams === null);
                setWeatherData(weather || {});
            }
        };

        fetchData();

        return () => {
            mounted = false;
        };
    }, [week, season]);

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

            // Every problem is collected — a lineup can have an empty slot AND
            // injured starters, and the modal shows all of them.
            const flagged = [];

            if (hasEmptySlots) {
                flagged.push({ pid: "empty", name: "Empty Slot", reason: "Empty Slot", severity: "INCOMPLETE" });
            }

            const playersPoints = m.players_points || {};
            const weatherFlagged = new Set();

            for (const pid of starters) {
                // Skip checks if player has already played (has points)
                const playerPoints = playersPoints[pid] || 0;
                if (playerPoints > 0) {
                    continue;
                }

                if (isDSTStarterId(pid)) {
                    if (byeTeamsThisWeek.has(pid)) {
                        flagged.push({ pid, name: `${pid} D/ST`, reason: "BYE", severity: "INCOMPLETE" });
                    }
                    continue;
                }

                const p = players[pid];
                if (!p) continue;

                const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
                const team = p.team;

                if (team && byeTeamsThisWeek.has(team)) {
                    flagged.push({ pid, name, reason: "BYE", severity: "INCOMPLETE" });
                    continue;
                }

                const bucket = classifyInjury(p);
                if (bucket === "INCOMPLETE") {
                    flagged.push({ pid, name, reason: (p.injury_status || p.status || "Out").toString(), severity: "INCOMPLETE" });
                } else if (bucket === "POTENTIAL") {
                    flagged.push({ pid, name, reason: (p.injury_status || p.status || "Questionable").toString(), severity: "POTENTIAL" });
                }

                // Weather check (POTENTIAL only, never INCOMPLETE). One flag per
                // NFL team, not one per affected starter.
                const teamWeather = weatherData[team];
                if (teamWeather?.isAdverse && !teamWeather?.isIndoor && !weatherFlagged.has(team)) {
                    weatherFlagged.add(team);
                    const weatherNote = teamWeather.displayValue || 'Adverse weather';
                    flagged.push({ pid: `weather-${team}`, name: `${team} Game`, reason: `Weather: ${weatherNote}`, severity: "POTENTIAL" });
                }
            }

            // The summary card renders flagged[0] as the chip, so the worst
            // problem has to lead — and a player problem always outranks a
            // weather note, which is never the thing you act on.
            const rank = (f) => (f.severity === "INCOMPLETE" ? 0 : 2) + (f.reason?.startsWith("Weather") ? 1 : 0);
            flagged.sort((a, b) => rank(a) - rank(b));

            const status = flagged.some(f => f.severity === "INCOMPLETE") ? "INCOMPLETE"
                : flagged.some(f => f.severity === "POTENTIAL") ? "POTENTIAL"
                    : "OK";

            out.push({
                roster_id: m.roster_id,
                owner_id: roster?.owner_id,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar || null, "thumbs"),
                status,
                flagged,
                matchup_id: m.matchup_id,
            });
        }

        return out;
    }, [matchups, players, rosterById, userById, byeTeamsThisWeek, weatherData]);

    const grouped = useMemo(() => {
        const g = { OK: [], POTENTIAL: [], INCOMPLETE: [] };
        for (const t of teams) g[t.status].push(t);
        return g;
    }, [teams]);

    return {
        teams,
        grouped,
        byeTeamsThisWeek,
        byesUnavailable,
        userById,
        rosterById
    };
}
