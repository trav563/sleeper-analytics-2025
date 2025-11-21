import { useOutletContext } from 'react-router-dom';
import RivalryMatrix from '../features/analytics/components/RivalryMatrix';

const HistoryPage = () => {
    const { user } = useOutletContext();

    return (
        <div className="space-y-8">
            <RivalryMatrix currentUserId={user?.user_id} />
        </div>
    );
};

export default HistoryPage;
