import { createContext, useState, useContext, useCallback, useEffect, useMemo } from 'react';
import { fetchUser, fetchUserLeagues } from '../utils/sleeper';
import { fetchLeagueHistory } from '../services/sleeperEngine';
import { clearLocalUserData, pruneAiAnalysisCache } from '../utils/localData';

const SleeperContext = createContext();

export const useSleeper = () => {
    const context = useContext(SleeperContext);
    if (!context) {
        throw new Error('useSleeper must be used within a SleeperProvider');
    }
    return context;
};

export const SleeperProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem('sleeper_user');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    });

    const [leagues, setLeagues] = useState([]);
    const [leagueHistory, setLeagueHistory] = useState(null);
    const [leagueChains, setLeagueChains] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [season, setSeason] = useState(null);

    // Fetch NFL state on mount to get current season
    // Fetch NFL state on mount to get current season
    useEffect(() => {
        const init = async () => {
            try {
                const { fetchNFLState } = await import('../utils/sleeper');
                const nfl = await fetchNFLState();
                setSeason(nfl.season);
            } catch (e) {
                console.error("Failed to fetch NFL state", e);
                // Fallback to current year if API fails
                setSeason(new Date().getFullYear().toString());
            }
        };
        init();
    }, []);

    // Housekeeping: expire stale AI narratives once per session.
    useEffect(() => { pruneAiAnalysisCache(); }, []);

    /** Forget this user on this device — needed on shared machines. */
    const signOut = useCallback(() => {
        clearLocalUserData();
        setUser(null);
        setLeagues([]);
        setLeagueHistory(null);
        setLeagueChains({});
        setError(null);
    }, []);

    const searchUser = useCallback(async (username) => {
        if (!username) return null;
        setLoading(true);
        setError(null);
        try {
            const userData = await fetchUser(username);
            if (!userData) throw new Error('User not found');
            setUser(userData);
            localStorage.setItem('sleeper_user', JSON.stringify(userData));
            return userData;
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to fetch user');
            setUser(null);
            localStorage.removeItem('sleeper_user');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getLeagues = useCallback(async (userId, seasonOverride) => {
        if (!userId) return [];
        // Use override, or state season; if neither has resolved yet, ask the
        // Sleeper NFL state directly so we never guess at a hardcoded year.
        let targetSeason = seasonOverride || season;

        setLoading(true);
        setError(null);
        try {
            if (!targetSeason) {
                const { fetchNFLState } = await import('../utils/sleeper');
                const nfl = await fetchNFLState();
                targetSeason = nfl.season;
                setSeason(nfl.season);
            }
            const userLeagues = await fetchUserLeagues(userId, targetSeason);
            setLeagues(userLeagues);
            // Chains are walked lazily when a league is opened (loadHistory
            // caches them in leagueChains). Pre-walking every league here fired
            // leagues × seasons × 2 uncancellable requests on login.
            return userLeagues;
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to fetch leagues');
            setLeagues([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, [season]);

    /** Find the cached chain that contains a given league_id, or null. */
    const findChainContaining = useCallback((urlLeagueId) => {
        if (!urlLeagueId) return null;
        for (const chain of Object.values(leagueChains)) {
            if (chain?.some((l) => l.league_id === urlLeagueId)) return chain;
        }
        return null;
    }, [leagueChains]);

    /** Set the active history chain. Used by LeagueLayout when navigating between leagues. */
    const selectActiveChain = useCallback((chain) => {
        setLeagueHistory(chain || []);
    }, []);

    // Keep fetchLeagueData for backward compatibility or convenience, using the new functions
    const fetchLeagueData = useCallback(async (username) => {
        const userData = await searchUser(username);
        if (userData) {
            // Wait for season to be set if it's not yet, or just use default
            await getLeagues(userData.user_id);
        }
    }, [searchUser, getLeagues]);

    const loadHistory = useCallback(async (currentLeagueId, userId) => {
        if (!currentLeagueId) {
            console.warn("Missing leagueId for history fetch");
            return;
        }

        setLoading(true);
        try {
            const { chain, truncated } = await fetchLeagueHistory(currentLeagueId, userId);
            if (truncated) {
                setError('League history may be incomplete — an older season failed to load.');
            }
            setLeagueHistory(chain || []);
            // Cache so findChainContaining resolves this family without
            // re-walking on later navigation.
            if (chain?.length) {
                setLeagueChains(prev => ({ ...prev, [currentLeagueId]: chain }));
            }
            return chain;
        } catch (err) {
            console.error("Failed to load league history:", err);
            setError("Failed to load league history");
            setLeagueHistory([]); // Ensure we don't stick on "loading"
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const value = useMemo(() => ({
        user,
        leagues,
        loading,
        error,
        season,
        searchUser,
        signOut,
        getLeagues,
        fetchLeagueData,
        loadHistory,
        leagueHistory,
        leagueChains,
        findChainContaining,
        selectActiveChain
    }), [
        user, leagues, loading, error, season,
        searchUser, signOut, getLeagues, fetchLeagueData, loadHistory,
        leagueHistory, leagueChains, findChainContaining, selectActiveChain
    ]);

    return (
        <SleeperContext.Provider value={value}>
            {children}
        </SleeperContext.Provider>
    );
};

export default SleeperContext;
