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

    const getLeagues = useCallback(async (userId, season = '2024') => {
        if (!userId) return [];
        setLoading(true);
        setError(null);
        try {
            const userLeagues = await fetchUserLeagues(userId, season);
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
    }, []);

    // Keep fetchLeagueData for backward compatibility or convenience, using the new functions
    const fetchLeagueData = useCallback(async (username) => {
        const userData = await searchUser(username);
        if (userData) {
            await getLeagues(userData.user_id, '2024');
        }
    }, [searchUser, getLeagues]);

    const value = {
        user,
        leagues,
        loading,
        error,
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
