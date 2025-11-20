import { useState, useEffect } from 'react';
import {
    fetchNFLState,
    fetchLeagueUsers,
    fetchLeagueRosters,
    fetchLeagueMatchups,
    fetchNFLPlayers,
    fetchLeague
} from '../utils/sleeper';

export function useLeagueData(leagueId) {
    const [state, setState] = useState(null);
    const [users, setUsers] = useState([]);
    const [rosters, setRosters] = useState([]);
    const [matchups, setMatchups] = useState([]);
    const [players, setPlayers] = useState(null);
    const [league, setLeague] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let aborted = false;

        async function run() {
            if (!leagueId) return;

            setLoading(true);
            setError(null);

            try {
                // Fetch NFL state first to get the current week
                const nfl = await fetchNFLState();
                if (aborted) return;
                setState(nfl);

                const week = nfl.display_week || nfl.week || nfl.leg;

                // Fetch all league data in parallel
                const [u, r, m, p, l] = await Promise.all([
                    fetchLeagueUsers(leagueId),
                    fetchLeagueRosters(leagueId),
                    fetchLeagueMatchups(leagueId, week),
                    fetchNFLPlayers(), // This is large, browser cache handles it after first load
                    fetchLeague(leagueId)
                ]);

                if (aborted) return;

                setUsers(u);
                setRosters(r);
                setMatchups(Array.isArray(m) ? m : []);
                setPlayers(p);
                setLeague(l);
            } catch (e) {
                console.error(e);
                setError(e?.message || "Failed to load data");
            } finally {
                if (!aborted) setLoading(false);
            }
        }

        run();

        return () => {
            aborted = true;
        };
    }, [leagueId]);

    return { state, users, rosters, matchups, players, league, loading, error };
}
