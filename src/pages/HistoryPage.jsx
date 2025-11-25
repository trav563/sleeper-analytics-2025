import { useOutletContext } from 'react-router-dom';
import RivalryMatrix from '../features/analytics/components/RivalryMatrix';

const HistoryPage = () => {
    const { user, users } = useOutletContext();

    return (
        <div className="space-y-8">
            <RivalryMatrix currentUserId={user?.user_id} users={users} />
        </div>
    );
};

export default HistoryPage;
