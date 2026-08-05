import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchLeagueMatchups, fetchWinnersBracket } from '../../../utils/sleeper';
import {
    buildRivalries,
    buildPlayoffKeys,
    pairKey,
    DEFAULT_PLAYOFF_WEEK_START,
    MAX_SCORED_WEEK,
} from '../../../utils/rivalries';

/** Fetch every week plus the championship bracket for one season. */
async function loadSeason(league) {
    const playoffWeekStart = league.playoff_week_start || DEFAULT_PLAYOFF_WEEK_START;

    // league.rosters is keyed by owner_id, so invert it.
    const rosterIdToOwnerId = {};
    Object.entries(league.rosters || {}).forEach(([ownerId, roster]) => {
        if (roster?.roster_id != null) rosterIdToOwnerId[roster.roster_id] = ownerId;
    });

    const [weeks, bracket] = await Promise.all([
        Promise.all(
            Array.from({ length: MAX_SCORED_WEEK }, (_, i) =>
                fetchLeagueMatchups(league.league_id, i + 1)
            )
        ),
        // A season with no postseason yet has no bracket; an empty one simply
        // means "no playoff games to credit".
        fetchWinnersBracket(league.league_id).catch(() => []),
    ]);

    return {
        season: league.season,
        playoffWeekStart,
        rosterIdToOwnerId,
        weeks,
        playoffKeys: buildPlayoffKeys(bracket, playoffWeekStart, rosterIdToOwnerId),
    };
}

const loadSeasons = (leagueHistory) => Promise.all(leagueHistory.map(loadSeason));

/**
 * Fetches every season in a league's history once, then derives head-to-head
 * records for all pairs. Both scopes ("reg" and "all") come out of that single
 * fetch, so switching scope in the UI is pure memo work with no extra requests.
 *
 * @param {Array} leagueHistory - from SleeperContext; entries carry
 *   `league_id`, `season`, `playoff_week_start` and `rosters` keyed by owner_id.
 * @param {string[]} currentOwnerIds - owners to include in the output.
 */
export function useRivalries(leagueHistory, currentOwnerIds) {
    // One piece of state tagged with the chain it belongs to, so `loading` and
    // `error` are derived rather than stored — no setState in the effect body,
    // and a chain switch can't briefly show the previous league's numbers.
    const [result, setResult] = useState(null); // { chainKey, seasons } | { chainKey, error }

    // Identify the chain by its league ids. The previous inline implementation
    // bailed on "we already have some data", so switching leagues never
    // refetched.
    const chainKey = useMemo(
        () => (leagueHistory || []).map((l) => l.league_id).join(','),
        [leagueHistory]
    );

    // Cache the in-flight/settled promise per chain. Context can hand back a
    // fresh array for the same chain, which re-runs this effect; reusing the
    // promise makes that a no-op instead of cancelling work already underway.
    const requestsRef = useRef(new Map());

    useEffect(() => {
        if (!chainKey || !leagueHistory?.length) return;

        let cancelled = false;
        let request = requestsRef.current.get(chainKey);
        if (!request) {
            request = loadSeasons(leagueHistory);
            requestsRef.current.set(chainKey, request);
        }

        request.then(
            (seasons) => {
                if (cancelled) return;
                // Bail when this chain's seasons are already in state, so a
                // re-run against the cached promise doesn't force a render.
                setResult((prev) =>
                    prev?.chainKey === chainKey && prev.seasons === seasons
                        ? prev
                        : { chainKey, seasons }
                );
            },
            (e) => {
                requestsRef.current.delete(chainKey); // allow a retry
                if (cancelled) return;
                console.error('Failed to fetch rivalry history', e);
                setResult({ chainKey, error: e });
            }
        );

        return () => {
            cancelled = true;
        };
    }, [chainKey, leagueHistory]);

    const current = result?.chainKey === chainKey ? result : null;
    const seasons = current?.seasons ?? null;
    const error = current?.error ?? null;
    const loading = !!chainKey && !current;

    // Stringified so a fresh array of the same ids doesn't rebuild everything.
    const ownerKey = useMemo(
        () => [...new Set((currentOwnerIds || []).filter(Boolean))].sort().join(','),
        [currentOwnerIds]
    );

    const rivalries = useMemo(() => {
        if (!seasons) return [];
        return buildRivalries({
            seasons,
            currentOwnerIds: ownerKey ? ownerKey.split(',') : [],
        });
    }, [seasons, ownerKey]);

    const byPair = useMemo(() => {
        const map = new Map();
        rivalries.forEach((r) => map.set(pairKey(r.aId, r.bId), r));
        return map;
    }, [rivalries]);

    return { rivalries, byPair, loading, error };
}

export default useRivalries;
