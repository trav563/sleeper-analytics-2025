import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import StandingsPower from '../features/analytics/components/StandingsPower';
import { useSeasonMatchups } from '../features/analytics/hooks/useSeasonMatchups';

const StandingsPage = () => {
    const ctx = useOutletContext();
    const { league, rosters, users, state, user, currentWeek } = ctx || {};
    const anchorWeek = currentWeek || state?.display_week || state?.week || 1;
    const [selectedWeek, setSelectedWeek] = useState(anchorWeek);

    useEffect(() => { setSelectedWeek(anchorWeek); }, [anchorWeek]);

    const { seasonMatchups } = useSeasonMatchups(league?.league_id, selectedWeek);
    const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <label className="inline-flex items-center gap-2 bg-bg-2 px-2.5 py-1 rounded-md border border-line">
                    <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">Through Week</span>
                    <select
                        className="bg-transparent text-sm font-semibold text-text border-none focus:ring-0 focus:outline-none cursor-pointer py-1 pr-6 tnum"
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    >
                        {weekOptions.map((w) => (
                            <option key={w} value={w}>
                                {w}{w === anchorWeek ? ' (Current)' : ''}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <StandingsPower
                league={league}
                rosters={rosters}
                users={users}
                seasonMatchups={seasonMatchups}
                currentUserId={user?.user_id}
                week={selectedWeek}
            />
        </div>
    );
};

export default StandingsPage;
