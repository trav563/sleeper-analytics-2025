import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSleeper } from '../context/SleeperContext';
import UserSearch from '../features/user/components/UserSearch';

const Home = () => {
    const navigate = useNavigate();
    const { user, lastLeagueId } = useSleeper();
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        if (user && lastLeagueId) {
            setRedirecting(true);
            // Brief delay so the user sees something before redirect
            const timer = setTimeout(() => {
                navigate(`/league/${lastLeagueId}`, { replace: true });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [user, lastLeagueId, navigate]);

    if (redirecting) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Returning to your league...</p>
                <button
                    onClick={() => setRedirecting(false)}
                    className="text-xs text-primary hover:underline"
                >
                    Switch league instead
                </button>
            </div>
        );
    }

    return <UserSearch />;
};

export default Home;
