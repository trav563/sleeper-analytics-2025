import { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { fetchUser, fetchUserLeagues } from '../utils/sleeper';
import { fetchLeagueHistory } from '../services/sleeperEngine';

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

    // Sync user changes to localStorage (in case it changes elsewhere or is cleared)
    useEffect(() => {
        if (user) {
            localStorage.setItem('sleeper_user', JSON.stringify(user));
        } else {
            // Optional: Only clear if explicitly logging out? 
            // For now, if user becomes null, we clear storage.
            // But searchUser sets it to null on error. 
            // Let's rely on searchUser to set it, but here we just sync.
            // Actually, safe to just sync whatever is in state.
            // Wait, if we initialize from storage, then set it to null, we want to clear storage.
            // If we initialize from null (first timer), we don't want to create empty entry? 
            // Actually, consistency is key.
        }
    }, [user]);
    const [leagues, setLeagues] = useState([]);
    const [leagueHistory, setLeagueHistory] = useState(null);
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
            // Don't clear user on failed search? Or do we? 
            // If just searching for a friend, we might not want to log out current user.
            // But usually this function is used for "Log In".
            // Let's leave state manipulation to the explicit actions.
            // But existing code sets setUser(null) on error.
            setUser(null);
            localStorage.removeItem('sleeper_user');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getLeagues = useCallback(async (userId, seasonOverride) => {
        if (!userId) return [];
        // Use override, or state season, or fallback to '2025'
        const targetSeason = seasonOverride || season || '2025';

        setLoading(true);
        setError(null);
        try {
            const userLeagues = await fetchUserLeagues(userId, targetSeason);
            setLeagues(userLeagues);
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

        console.log(`Loading history for league ${currentLeagueId} and user ${userId}`);
        setLoading(true);
        try {
            const history = await fetchLeagueHistory(currentLeagueId, userId);
            console.log("History loaded:", history);
            setLeagueHistory(history || []);
            return history;
        } catch (err) {
            console.error("Failed to load league history:", err);
            setError("Failed to load league history");
            setLeagueHistory([]); // Ensure we don't stick on "loading"
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const value = {
        user,
        leagues,
        loading,
        error,
        season,
        searchUser,
        getLeagues,
        fetchLeagueData,
        loadHistory,
        leagueHistory
    };

    return (
        <SleeperContext.Provider value={value}>
            {children}
        </SleeperContext.Provider>
    );
};

export default SleeperContext;
