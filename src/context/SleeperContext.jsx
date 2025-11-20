import { createContext, useState, useContext, useCallback } from 'react';
import { fetchUser, fetchUserLeagues } from '../utils/sleeper';

const SleeperContext = createContext();

export const useSleeper = () => {
    const context = useContext(SleeperContext);
    if (!context) {
        throw new Error('useSleeper must be used within a SleeperProvider');
    }
    return context;
};

export const SleeperProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [leagues, setLeagues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [season, setSeason] = useState(null);

    // Fetch NFL state on mount to get current season
    useState(() => {
        const init = async () => {
            try {
                const nfl = await import('../utils/sleeper').then(m => m.fetchNFLState());
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
            return userData;
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to fetch user');
            setUser(null);
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

    const value = {
        user,
        leagues,
        loading,
        error,
        season,
        searchUser,
        getLeagues,
        fetchLeagueData
    };

    return (
        <SleeperContext.Provider value={value}>
            {children}
        </SleeperContext.Provider>
    );
};

export default SleeperContext;
