/** Input must contain completed weeks only. A zero is a score, never a finality flag. */
export function completedStandings(rosters = [], weeks = {}) {
    const teams = Object.fromEntries(rosters.map(r => [r.roster_id, { rosterId: r.roster_id, wins: 0, losses: 0, ties: 0,
        totalPoints: 0, opponentPoints: 0, gamesPlayed: 0, opponentGames: 0, allPlayWins: 0, allPlayLosses: 0, allPlayTies: 0 }]));
    for (const rows of Object.values(weeks)) {
        if (!Array.isArray(rows)) continue;
        const scored = rows.filter(m => teams[m.roster_id] && Number.isFinite(m.points) && m.matchup_id != null && rows.filter(o => o.matchup_id === m.matchup_id && Number.isFinite(o.points)).length === 2);
        const pairs = {};
        for (const m of scored) {
            const t = teams[m.roster_id];
            t.totalPoints += m.points; t.gamesPlayed++;
            if (m.matchup_id != null) (pairs[m.matchup_id] ||= []).push(m);
            for (const other of scored) if (m.roster_id !== other.roster_id) {
                if (m.points > other.points) t.allPlayWins++;
                else if (m.points < other.points) t.allPlayLosses++;
                else t.allPlayTies++;
            }
        }
        for (const pair of Object.values(pairs)) if (pair.length === 2) {
            for (let i = 0; i < 2; i++) {
                const m = pair[i], other = pair[1 - i], t = teams[m.roster_id];
                t.opponentPoints += other.points; t.opponentGames++;
                if (m.points > other.points) t.wins++;
                else if (m.points < other.points) t.losses++;
                else t.ties++;
            }
        }
    }
    return Object.values(teams).map(t => ({ ...t,
        ppg: t.gamesPlayed ? t.totalPoints / t.gamesPlayed : 0,
        sos: t.opponentGames ? t.opponentPoints / t.opponentGames : 0,
        winPct: t.opponentGames ? (t.wins + t.ties / 2) / t.opponentGames : 0,
        apWinPct: (t.allPlayWins + t.allPlayTies / 2) / (t.allPlayWins + t.allPlayLosses + t.allPlayTies || 1),
        record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`,
    }));
}

/** Completed-week production; maximum points use only players in that weekly roster. */
export function completedProduction(rosters, weeks, slots, players, assign) {
    return completedStandings(rosters, weeks).map(t => {
        let maxPoints = 0;
        for (const rows of Object.values(weeks || {})) {
            const matchup = rows?.find(m => m.roster_id === t.rosterId);
            if (!matchup) continue;
            const pool = (matchup.players || Object.keys(matchup.players_points || {})).map(id => ({ ...players?.[id], id }))
                .filter(p => p.position && Number.isFinite(matchup.players_points?.[p.id]));
            maxPoints += assign(slots || [], pool, p => matchup.players_points[p.id]).total;
        }
        return { ...t, maxPoints, maxPpg: t.gamesPlayed ? maxPoints / t.gamesPlayed : 0 };
    });
}
