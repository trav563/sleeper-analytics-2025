import { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Clock, Trophy, ChevronDown, ChevronUp, Wifi, WifiOff, CalendarClock, Sparkles, History } from 'lucide-react';
import { useLiveDraft } from '../hooks/useLiveDraft';
import { fetchMarketValues } from '../../../utils/fantasyCalc';
import { fetchLeague, fetchLeagueDrafts, fetchUserLeagues } from '../../../utils/sleeper';
import { calculateDraftGrades, getLeagueFormatLabels } from '../../../utils/draftEngine';
import { displayTeamName } from '../../../utils/nflData';
import { Card, CardContent } from '../../../components/ui/Card';
import DraftPickFeed from './DraftPickFeed';
import TeamNeedsPanel from './TeamNeedsPanel';
import RecommendationsPanel from './RecommendationsPanel';
import DraftBoardMini from './DraftBoardMini';

/**
 * LiveDraftAssistant — Main container for the live draft experience.
 * Renders Pre-Draft, Live, or Complete states based on draft status.
 * Supports a year selector to view past draft grades.
 */
const LiveDraftAssistant = ({ league, rosters, users, user, players, state }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [liveTimestamp, setLiveTimestamp] = useState(Date.now());
    const [selectedDraftId, setSelectedDraftId] = useState(null); // null = auto-select
    const [selectedSeason, setSelectedSeason] = useState(null);

    // ─── Fetch all seasons via league history chain ───────────────────
    // Strategy: First find the "head" (newest season) of this league chain
    // by checking user's leagues for recent years, then traverse backward.
    const { data: seasonDrafts = [] } = useQuery({
        queryKey: ['allSeasonDrafts', league?.league_id, user?.user_id],
        queryFn: async () => {
            if (!league?.league_id) return [];
            
            // Step 1: Build the backward chain from current league to find all known IDs
            const knownLeagueIds = new Set();
            let walkId = league.league_id;
            let walkSafety = 0;
            while (walkId && walkSafety < 10) {
                knownLeagueIds.add(walkId);
                try {
                    const ld = await fetchLeague(walkId);
                    walkId = ld?.previous_league_id;
                } catch { break; }
                walkSafety++;
            }

            // Step 2: Find the newest league in this chain
            // Check ALL league members' accounts for newer seasons
            let headLeagueId = league.league_id;
            const memberIds = users?.map(u => u.user_id).filter(Boolean) || [];
            
            if (memberIds.length > 0) {
                const currentYear = new Date().getFullYear();
                let found = false;
                
                // Try each year from newest to current league season
                for (let year = currentYear; year > Number(league.season || 2024) && !found; year--) {
                    // Try each member until we find the forward link
                    for (const memberId of memberIds) {
                        if (found) break;
                        try {
                            const memberLeagues = await fetchUserLeagues(memberId, String(year));
                            for (const ul of memberLeagues) {
                                if (knownLeagueIds.has(ul.league_id)) continue;
                                
                                // Quick check: does this league's previous_league_id directly match?
                                if (knownLeagueIds.has(ul.previous_league_id)) {
                                    headLeagueId = ul.league_id;
                                    knownLeagueIds.add(ul.league_id);
                                    found = true;
                                    
                                    // Now check if there's an even newer league pointing to this one
                                    // (e.g., 2026 pointing to 2025)
                                    for (const memberId2 of memberIds) {
                                        try {
                                            const newerLeagues = await fetchUserLeagues(memberId2, String(year + 1));
                                            for (const nl of newerLeagues) {
                                                if (nl.previous_league_id === headLeagueId) {
                                                    headLeagueId = nl.league_id;
                                                    knownLeagueIds.add(nl.league_id);
                                                    break;
                                                }
                                            }
                                        } catch {}
                                        if (headLeagueId !== ul.league_id) break;
                                    }
                                    break;
                                }
                            }
                        } catch {}
                    }
                }
            }

            // Step 3: Traverse backward from the head to build the full season list
            const seasons = [];
            let currentId = headLeagueId;
            let safety = 0;

            while (currentId && safety < 10) {
                try {
                    const leagueData = await fetchLeague(currentId);
                    if (!leagueData) break;

                    const drafts = await fetchLeagueDrafts(currentId);
                    const completedDrafts = (drafts || []).filter(d => d.status === 'complete');
                    
                    completedDrafts.forEach(d => {
                        seasons.push({
                            season: leagueData.season,
                            league_id: currentId,
                            draft_id: d.draft_id,
                            type: d.type,
                            settings: d.settings,
                        });
                    });

                    currentId = leagueData.previous_league_id;
                    safety++;
                } catch {
                    break;
                }
            }

            // Sort by season descending
            return seasons.sort((a, b) => Number(b.season) - Number(a.season));
        },
        enabled: !!league?.league_id,
        staleTime: 10 * 60 * 1000, // 10 min cache
    });

    const {
        draft, picks, shouldShow, isLive, isPreDraft, isComplete, isLoading,
        userPicks, onTheClock, isUserOnTheClock, timeRemaining, timeUntilStart,
        draftedPlayerIds, userRosterId, rosterIdToUserId, totalTeams,
    } = useLiveDraft(league?.league_id, user?.user_id, players, selectedDraftId);

    // Tick every second for countdown timers
    useEffect(() => {
        if (!isLive && !isPreDraft) return;
        const interval = setInterval(() => setLiveTimestamp(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [isLive, isPreDraft]);

    // Fetch market values for recommendations
    const isSuperflex = league?.roster_positions?.includes('SUPER_FLEX');
    const numTeams = users?.length || 12;

    const { data: marketValues = {} } = useQuery({
        queryKey: ['marketValues', isSuperflex, numTeams],
        queryFn: () => fetchMarketValues(isSuperflex, numTeams, 0.5),
        staleTime: 60 * 60 * 1000,
        enabled: shouldShow,
    });

    // Find existing roster for dynasty rookie drafts
    const existingRoster = useMemo(() => {
        if (!rosters || !user) return [];
        const userRoster = rosters.find(r => r.owner_id === user.user_id);
        return userRoster?.players || [];
    }, [rosters, user]);

    // Draft grades (for complete state)
    const draftGrades = useMemo(() => {
        if (!isComplete || !picks?.length) return {};
        return calculateDraftGrades(picks, marketValues, totalTeams || 12);
    }, [isComplete, picks, marketValues, totalTeams]);

    // Handle year selection
    const handleSeasonChange = useCallback((draftId, season) => {
        if (draftId === 'auto') {
            setSelectedDraftId(null);
            setSelectedSeason(null);
        } else {
            setSelectedDraftId(draftId);
            setSelectedSeason(season);
        }
    }, []);

    // Auto-select latest completed draft if current auto-selection is a far-future pre-draft
    useEffect(() => {
        if (selectedDraftId) return; // User already made a manual selection
        if (!isPreDraft || !seasonDrafts.length) return;
        
        // Check if the pre-draft is more than 15 minutes away
        const isFarFuture = draft?.start_time 
            ? (draft.start_time - Date.now()) > 15 * 60 * 1000
            : false;
        
        if (isFarFuture) {
            // Pick the most recent completed draft from season history
            const latestCompleted = seasonDrafts[0]; // Already sorted descending
            if (latestCompleted) {
                setSelectedDraftId(latestCompleted.draft_id);
                setSelectedSeason(latestCompleted.season);
            }
        }
    }, [isPreDraft, draft, seasonDrafts, selectedDraftId]);

    // Don't render if no draft to show and no season history
    if ((!shouldShow && !seasonDrafts.length) || isLoading) return null;


    const formatCountdown = (seconds) => {
        if (seconds == null) return 'Scheduled';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    // Status badge config
    const statusConfig = isLive 
        ? { label: 'LIVE', icon: Radio, color: 'bg-red-500/20 text-red-400 border-red-500/30', pulse: true }
        : isPreDraft
            ? { label: 'PRE-DRAFT', icon: CalendarClock, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', pulse: false }
            : { label: 'COMPLETE', icon: Trophy, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', pulse: false };

    const StatusIcon = statusConfig.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card className="border-slate-700/60 overflow-hidden relative">
                {/* Live indicator glow */}
                {isLive && (
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent pointer-events-none" />
                )}

                {/* Header */}
                <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/30 transition-colors relative z-10"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isLive ? 'bg-red-500/10' : 'bg-slate-700/40'}`}>
                            <Sparkles className={`w-5 h-5 ${isLive ? 'text-red-400' : 'text-blue-400'}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white">Draft Assistant</h3>
                                <span className={`flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''}`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {statusConfig.label}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {isLive && `${picks.length} picks made • ${draft?.type} draft`}
                                {isPreDraft && (timeUntilStart != null ? `Starts in ${formatCountdown(timeUntilStart)}` : 'Waiting to start...')}
                                {isComplete && `${picks.length} picks • ${selectedSeason || draft?.season || ''} Draft complete`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isLive && (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                                <Wifi className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-mono">Live</span>
                            </div>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </div>

                {/* Season Selector */}
                {seasonDrafts.length > 0 && isExpanded && (
                    <div className="px-4 pb-2 relative z-10">
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                            <History className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <div className="flex gap-1.5">
                                {seasonDrafts.map((sd) => {
                                    const isActive = selectedDraftId 
                                        ? selectedDraftId === sd.draft_id
                                        : (!selectedDraftId && draft?.draft_id === sd.draft_id);
                                    return (
                                        <button
                                            key={sd.draft_id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSeasonChange(sd.draft_id, sd.season);
                                            }}
                                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                                                isActive
                                                    ? 'bg-primary/20 text-primary border border-primary/40 shadow-sm shadow-primary/10'
                                                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:bg-slate-700/60 hover:text-slate-300'
                                            }`}
                                        >
                                            {sd.season}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Collapsible Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                        >
                            <CardContent className="p-4 pt-0 relative z-10">
                                {/* ── PRE-DRAFT STATE ──────────────────── */}
                                {isPreDraft && (
                                    <PreDraftView draft={draft} league={league} users={users} user={user} timeUntilStart={timeUntilStart} rosterIdToUserId={rosterIdToUserId} />
                                )}

                                {/* ── LIVE STATE ──────────────────────── */}
                                {isLive && (
                                    <div className="space-y-4">
                                        {/* Three-panel layout */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            {/* Left: Pick Feed */}
                                            <div className="lg:col-span-1 bg-slate-800/30 rounded-lg border border-slate-700/30 p-3">
                                                <DraftPickFeed 
                                                    picks={picks}
                                                    users={users}
                                                    draft={draft}
                                                    onTheClock={onTheClock}
                                                    isUserOnTheClock={isUserOnTheClock}
                                                    timeRemaining={timeRemaining}
                                                    userRosterId={userRosterId}
                                                    rosterIdToUserId={rosterIdToUserId}
                                                    isLive={isLive}
                                                />
                                            </div>

                                            {/* Center: Team Needs */}
                                            <div className="lg:col-span-1 bg-slate-800/30 rounded-lg border border-slate-700/30 p-3">
                                                <TeamNeedsPanel 
                                                    league={league}
                                                    userPicks={userPicks}
                                                    players={players}
                                                    existingRoster={existingRoster}
                                                />
                                            </div>

                                            {/* Right: Recommendations */}
                                            <div className="lg:col-span-1 bg-slate-800/30 rounded-lg border border-slate-700/30 p-3">
                                                <RecommendationsPanel
                                                    league={league}
                                                    players={players}
                                                    draftedPlayerIds={draftedPlayerIds}
                                                    marketValues={marketValues}
                                                    userPicks={userPicks}
                                                    existingRoster={existingRoster}
                                                />
                                            </div>
                                        </div>

                                        {/* Draft Board */}
                                        <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-3">
                                            <DraftBoardMini
                                                draft={draft}
                                                picks={picks}
                                                users={users}
                                                onTheClock={onTheClock}
                                                userRosterId={userRosterId}
                                                rosterIdToUserId={rosterIdToUserId}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* ── COMPLETE STATE ───────────────────── */}
                                {isComplete && (
                                    <CompleteDraftView 
                                        draft={draft} 
                                        picks={picks} 
                                        users={users} 
                                        draftGrades={draftGrades} 
                                        userRosterId={userRosterId}
                                        rosterIdToUserId={rosterIdToUserId}
                                        league={league}
                                        players={players}
                                        draftedPlayerIds={draftedPlayerIds}
                                        marketValues={marketValues}
                                        userPicks={userPicks}
                                        existingRoster={existingRoster}
                                        onTheClock={onTheClock}
                                    />
                                )}
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
        </motion.div>
    );
};


// ─── Pre-Draft Sub-View ──────────────────────────────────────────────
const PreDraftView = ({ draft, league, users, user, timeUntilStart, rosterIdToUserId }) => {
    const userSlot = user?.user_id && draft?.draft_order?.[user.user_id];
    const formatLabels = getLeagueFormatLabels(league?.scoring_settings || {}, league?.roster_positions || []);

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-lg border border-amber-500/20 p-5 text-center">
                <CalendarClock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h4 className="text-lg font-bold text-white mb-1">Draft Starting Soon</h4>
                {timeUntilStart != null && (
                    <p className="text-3xl font-mono font-bold text-amber-400 my-3 tabular-nums">
                        {Math.floor(timeUntilStart / 60)}:{String(timeUntilStart % 60).padStart(2, '0')}
                    </p>
                )}
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                    <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-1 rounded">{draft?.type} draft</span>
                    <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-1 rounded">{draft?.settings?.teams || 12} teams</span>
                    <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-1 rounded">{draft?.settings?.rounds || 15} rounds</span>
                    <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-1 rounded">{draft?.settings?.pick_timer || 60}s timer</span>
                </div>
            </div>

            {userSlot && (
                <div className="bg-slate-800/40 rounded-lg border border-slate-700/30 p-4 text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Your Draft Position</p>
                    <p className="text-4xl font-bold text-primary">#{userSlot}</p>
                    <p className="text-xs text-slate-500 mt-1">
                        {draft?.type === 'snake' 
                            ? `1st pick: #${userSlot}, 2nd pick: #${(draft?.settings?.teams || 12) * 2 - userSlot + 1}`
                            : `Every round: Pick #${userSlot}`}
                    </p>
                </div>
            )}

            {/* League Format */}
            <div className="flex flex-wrap gap-1.5 justify-center">
                {formatLabels.map((label, i) => (
                    <span key={i} className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/30">
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
};


// ─── Complete Draft Sub-View ─────────────────────────────────────────
const CompleteDraftView = ({ draft, picks, users, draftGrades, userRosterId, rosterIdToUserId, league, players, draftedPlayerIds, marketValues, userPicks, existingRoster, onTheClock }) => {
    const getUserForRoster = (rosterId) => {
        const uid = rosterIdToUserId?.[String(rosterId)];
        return users.find(u => u.user_id === uid);
    };

    const gradeColor = (grade) => {
        if (grade.startsWith('A')) return 'text-emerald-400';
        if (grade.startsWith('B')) return 'text-blue-400';
        if (grade.startsWith('C')) return 'text-amber-400';
        return 'text-red-400';
    };

    const sortedGrades = Object.entries(draftGrades)
        .sort((a, b) => a[1].rank - b[1].rank);

    return (
        <div className="space-y-4">
            {/* Draft Grades */}
            {sortedGrades.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-slate-200">Draft Grades</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {sortedGrades.map(([rid, data]) => {
                            const gradeUser = getUserForRoster(rid);
                            const isUser = String(rid) === String(userRosterId);
                            return (
                                <div key={rid} className={`p-3 rounded-lg border transition-colors ${
                                    isUser 
                                        ? 'bg-primary/10 border-primary/30' 
                                        : 'bg-slate-800/40 border-slate-700/30'
                                }`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-2xl font-black ${gradeColor(data.grade)}`}>{data.grade}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">#{data.rank}</span>
                                    </div>
                                    <p className="text-xs font-medium text-slate-300 truncate">
                                        {gradeUser ? displayTeamName(gradeUser) : `Team ${rid}`}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                        {data.avgEfficiency}% efficiency • {data.picks} picks
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Draft Board */}
            <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-3">
                <DraftBoardMini
                    draft={draft}
                    picks={picks}
                    users={users}
                    onTheClock={onTheClock}
                    userRosterId={userRosterId}
                    rosterIdToUserId={rosterIdToUserId}
                />
            </div>

            {/* User's Needs (post-draft, useful for dynasty) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-3">
                    <TeamNeedsPanel 
                        league={league}
                        userPicks={userPicks}
                        players={players}
                        existingRoster={existingRoster}
                    />
                </div>
                <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-3">
                    <DraftPickFeed 
                        picks={picks}
                        users={users}
                        draft={draft}
                        onTheClock={onTheClock}
                        isUserOnTheClock={false}
                        timeRemaining={null}
                        userRosterId={userRosterId}
                        rosterIdToUserId={rosterIdToUserId}
                        isLive={false}
                    />
                </div>
            </div>
        </div>
    );
};

export default LiveDraftAssistant;
