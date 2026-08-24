import { useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useLeagueData } from '../hooks/useLeagueData';
import { useLineupStatus } from '../hooks/useLineupStatus';
import { deriveCurrentWeek } from '../../../utils/seasonState';
import { avatarUrl, STATUS_COLORS } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import TeamLineupModal from './TeamLineupModal';

// Same tone vocabulary as the dashboard InjuryReport chips.
const REASON_TONE = {
    IR:             'bg-bad/15 text-bad border-bad/40',
    Out:            'bg-bad/15 text-bad border-bad/30',
    PUP:            'bg-bad/15 text-bad border-bad/30',
    'Empty Slot':   'bg-bad/15 text-bad border-bad/30',
    BYE:            'bg-signal-2/15 text-signal-2 border-signal-2/30',
    Doubtful:       'bg-signal-2/15 text-signal-2 border-signal-2/30',
    Questionable:   'bg-warn/15 text-warn border-warn/30',
};
const defaultReasonTone = 'bg-bg-3 text-text-dim border-line';
const toneFor = (reason) =>
    REASON_TONE[reason] || (reason?.startsWith('Weather') ? REASON_TONE.Doubtful : defaultReasonTone);

/** One dense row per team — the whole row opens the full lineup modal. */
const TeamRow = ({ team, onClick }) => {
    const first = team.flagged?.[0];
    const extra = Math.max(0, (team.flagged?.length || 0) - 1);
    return (
        <li>
            <button
                type="button"
                onClick={() => onClick(team)}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-bg-2/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
            >
                {team.avatar ? (
                    <img src={team.avatar} alt="" loading="lazy" className="w-7 h-7 rounded-full ring-1 ring-line shrink-0" />
                ) : (
                    <Pip seed={team.roster_id ?? team.name} name={team.name} size={28} />
                )}
                <span className="text-sm font-semibold text-text truncate flex-1 min-w-0">{team.name}</span>
                {first && (
                    <span className="flex items-center gap-1.5 shrink-0">
                        {/* Empty slots name themselves "Empty Slot", which the
                            chip already says — don't print it twice. */}
                        {first.name && first.name !== first.reason && (
                            <span className="hidden sm:inline text-xs text-text-dim truncate max-w-[160px]">
                                {first.name}
                            </span>
                        )}
                        <span className={`font-mono text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${toneFor(first.reason)}`}>
                            {first.reason}
                        </span>
                        {extra > 0 && (
                            <span className="font-mono text-2xs text-text-mute tnum">+{extra}</span>
                        )}
                    </span>
                )}
            </button>
        </li>
    );
};

/** Collapsed group — count visible, rows one click away. */
const Bucket = ({ label, teams, onTeamClick }) => {
    if (!teams.length) return null;
    return (
        <details className="group border-t border-line">
            <summary className="cursor-pointer px-4 py-2 font-mono text-2xs uppercase tracking-wider text-text-dim hover:text-signal transition-colors duration-fast list-none inline-flex items-center gap-1 select-none">
                <span className="group-open:rotate-90 transition-transform duration-fast inline-block">›</span>
                <span className="tnum">{teams.length}</span> {label}
            </summary>
            <ul className="divide-y divide-line border-t border-line">
                {teams.map((t) => (
                    <TeamRow key={t.roster_id} team={t} onClick={onTeamClick} />
                ))}
            </ul>
        </details>
    );
};

const LineupChecker = ({ leagueId }) => {
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedMatchup, setSelectedMatchup] = useState(null);

    const { state, users, rosters, matchups, players, league, loading, error, refresh } = useLeagueData(leagueId);

    const week = deriveCurrentWeek(league, state);
    const seasonType = state?.season_type || "regular";
    const isPreseason = seasonType === "pre";

    const { grouped, byeTeamsThisWeek } = useLineupStatus(week, users, rosters, matchups, players);

    const getMatchupForTeam = useCallback((team) => {
        if (!team || !matchups) return null;
        return matchups.find(m => m.roster_id === team.roster_id);
    }, [matchups]);

    const handleTeamClick = useCallback((team) => {
        const matchup = getMatchupForTeam(team);
        setSelectedTeam(team);
        setSelectedMatchup(matchup);
    }, [getMatchupForTeam]);

    const handleCloseModal = useCallback(() => {
        setSelectedTeam(null);
        setSelectedMatchup(null);
    }, []);

    // Incomplete lineups are the only true action items, so they're the only
    // rows open by default; the rest are one click away with counts visible.
    const incomplete = grouped.INCOMPLETE || [];
    const potential = grouped.POTENTIAL || [];
    const complete = grouped.OK || [];

    const counts = [
        { key: 'INCOMPLETE', label: 'Incomplete', n: incomplete.length, dot: STATUS_COLORS.DOT.INCOMPLETE },
        { key: 'POTENTIAL', label: 'Issues', n: potential.length, dot: STATUS_COLORS.DOT.POTENTIAL },
        { key: 'OK', label: 'Complete', n: complete.length, dot: STATUS_COLORS.DOT.OK },
    ];

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <ClipboardCheck className="w-3 h-3 text-signal" aria-hidden="true" />
                        Tool · Lineup Check
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-text">
                        Lineup Completeness
                        <span className="ml-2 font-mono text-2xs uppercase tracking-wider text-text-mute font-normal">
                            {isPreseason ? 'Preseason' : 'Regular'} · Wk <span className="tnum text-text-dim">{week ?? '—'}</span>
                        </span>
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    title="Refresh"
                    aria-label="Refresh lineup data"
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md bg-bg-2 hover:bg-bg-3 text-text-dim hover:text-text border border-line transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </header>

            {loading && (
                <div className="flex justify-center items-center py-8">
                    <div className="h-8 w-8 rounded-full border-2 border-line border-t-signal animate-spin" />
                </div>
            )}

            {error && (
                <div className="m-4 p-3 rounded-md bg-bad/10 border border-bad/30 text-bad text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="px-4 py-2.5 border-b border-line flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-2xs uppercase tracking-wider text-text-mute">
                        {counts.map((c) => (
                            <span key={c.key} className="inline-flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                                {c.label} <span className="text-text-dim tnum">{c.n}</span>
                            </span>
                        ))}
                    </div>

                    {incomplete.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-text-dim">
                            No incomplete lineups. Nothing needs fixing this week.
                        </p>
                    ) : (
                        <ul className="divide-y divide-line">
                            {incomplete.map((t) => (
                                <TeamRow key={t.roster_id} team={t} onClick={handleTeamClick} />
                            ))}
                        </ul>
                    )}

                    <Bucket label="with potential issues" teams={potential} onTeamClick={handleTeamClick} />
                    <Bucket label="complete" teams={complete} onTeamClick={handleTeamClick} />
                </>
            )}

            {selectedTeam && selectedMatchup && (
                <TeamLineupModal
                    team={selectedTeam}
                    matchup={selectedMatchup}
                    players={players}
                    byeTeamsThisWeek={byeTeamsThisWeek}
                    league={league}
                    onClose={handleCloseModal}
                />
            )}
        </section>
    );
};

export default LineupChecker;
