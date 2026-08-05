import { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import PowerRankings from '../features/analytics/components/PowerRankings';
import TrueStandings from '../features/analytics/components/TrueStandings';
import TeamRadar from '../features/analytics/components/TeamRadar';
import RivalryMatrix from '../features/analytics/components/RivalryMatrix';
import { displayTeamName } from '../utils/nflData';
import { SegmentedTabs } from '../components/ui/SegmentedTabs';

const AnalyticsPage = () => {
    const { leagueId } = useParams();
    const { league, rosters, users, players, user, currentWeek } = useOutletContext();

    const [selectedRosterId, setSelectedRosterId] = useState(null);
    const [comparisonMode, setComparisonMode] = useState('league'); // 'league' | 'h2h'
    const [opponentRosterId, setOpponentRosterId] = useState(null);

    useEffect(() => {
        if (!rosters || rosters.length === 0) return;
        if (selectedRosterId && rosters.find(r => r.roster_id === selectedRosterId)) return;
        if (user) {
            const userRoster = rosters.find(r => r.owner_id === user.user_id);
            if (userRoster) {
                setSelectedRosterId(userRoster.roster_id);
                return;
            }
        }
        setSelectedRosterId(rosters[0].roster_id);
    }, [rosters, user, selectedRosterId]);

    const handleTeamChange = (e) => setSelectedRosterId(Number(e.target.value));
    const handleOpponentChange = (e) => setOpponentRosterId(Number(e.target.value));

    const selectedUser = users?.find(u => u.user_id === rosters?.find(r => r.roster_id === selectedRosterId)?.owner_id);
    const opponentUser = users?.find(u => u.user_id === rosters?.find(r => r.roster_id === opponentRosterId)?.owner_id);

    const positionalControls = (
        <div className="flex flex-col gap-2">
            <SegmentedTabs
                tabs={[
                    { value: 'league', label: 'vs League' },
                    { value: 'h2h', label: 'Head-to-Head' },
                ]}
                value={comparisonMode}
                onChange={setComparisonMode}
            />
            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                <select
                    className="bg-bg-2 border border-line text-text text-sm rounded-md min-h-[40px] px-3 focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal block w-full transition-colors duration-fast"
                    value={selectedRosterId || ''}
                    onChange={handleTeamChange}
                    aria-label="Select team"
                >
                    {rosters?.map(roster => {
                        const rosterUser = users?.find(u => u.user_id === roster.owner_id);
                        return (
                            <option key={roster.roster_id} value={roster.roster_id}>
                                {displayTeamName(rosterUser)}
                            </option>
                        );
                    })}
                </select>
                {comparisonMode === 'h2h' && (
                    <>
                        <span className="font-mono text-2xs uppercase tracking-wider text-text-mute self-center px-1">VS</span>
                        <select
                            className="bg-bg-2 border border-line text-text text-sm rounded-md min-h-[40px] px-3 focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal block w-full transition-colors duration-fast"
                            value={opponentRosterId || ''}
                            onChange={handleOpponentChange}
                            aria-label="Select opponent"
                        >
                            <option value="" disabled>Select opponent</option>
                            {rosters?.filter(r => r.roster_id !== selectedRosterId).map(roster => {
                                const rosterUser = users?.find(u => u.user_id === roster.owner_id);
                                return (
                                    <option key={roster.roster_id} value={roster.roster_id}>
                                        {displayTeamName(rosterUser)}
                                    </option>
                                );
                            })}
                        </select>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <PowerRankings
                leagueId={leagueId}
                currentWeek={currentWeek}
                rosters={rosters}
                users={users}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TrueStandings
                    leagueId={leagueId}
                    currentWeek={currentWeek}
                    rosters={rosters}
                    users={users}
                />
                <TeamRadar
                    leagueId={leagueId}
                    currentWeek={currentWeek}
                    rosters={rosters}
                    players={players}
                    userRosterId={selectedRosterId}
                    opponentRosterId={comparisonMode === 'h2h' ? opponentRosterId : null}
                    opponentTeamName={comparisonMode === 'h2h' ? displayTeamName(opponentUser) : null}
                    users={users}
                    headerExtras={positionalControls}
                />
            </div>

            <RivalryMatrix
                currentUserId={user?.user_id}
                users={users}
                selectedUser1Id={selectedUser?.user_id}
                selectedUser2Id={comparisonMode === 'h2h' ? opponentUser?.user_id : null}
                leagueId={leagueId}
                leagueName={league?.name}
            />
        </div>
    );
};

export default AnalyticsPage;
