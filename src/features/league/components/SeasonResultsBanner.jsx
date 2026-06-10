import React, { useEffect, useState } from 'react';
import {
    fetchLeague,
    fetchLeagueWinnersBracket,
    fetchLeagueLosersBracket,
    fetchLeagueUsers,
    fetchLeagueTransactions,
    fetchDraftPicks,
    fetchLeagueRosters
} from '../../../utils/sleeper';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Trophy, Ghost, Crown, Trash2 } from 'lucide-react';

const SeasonResultsBanner = ({ league }) => {
    const [champion, setChampion] = useState(null);
    const [toiletChamp, setToiletChamp] = useState(null);
    const [toiletTitle, setToiletTitle] = useState("Last Place Finish");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!league?.league_id) return;

        const loadSeasonData = async () => {
            setLoading(true);
            try {
                // 1. FRESH & SMART FETCHING
                console.log(`[SeasonResults] performing fresh fetch for league: ${league.league_id}`);
                const currentLeagueData = await fetchLeague(league.league_id);

                // Auto-Switch Logic
                let targetLeagueId = currentLeagueData.league_id;
                let targetLeagueData = currentLeagueData;

                if ((currentLeagueData.status === 'pre_draft' || currentLeagueData.season === '2026') && currentLeagueData.previous_league_id) {
                    console.log(`[SeasonResults] Rollover detected. Switching to Previous League ID: ${currentLeagueData.previous_league_id}`);
                    targetLeagueId = currentLeagueData.previous_league_id;
                    targetLeagueData = await fetchLeague(targetLeagueId);
                } else {
                    console.log(`[SeasonResults] Using current League ID: ${targetLeagueId}`);
                }

                // 2. DATA COLLECTION
                const [wBracket, lBracket, usersData, transactionsData, draftData, rostersData] = await Promise.all([
                    fetchLeagueWinnersBracket(targetLeagueId),
                    fetchLeagueLosersBracket(targetLeagueId),
                    fetchLeagueUsers(targetLeagueId),
                    fetchLeagueTransactions(targetLeagueId, 1),
                    targetLeagueData.draft_id ? fetchDraftPicks(targetLeagueData.draft_id) : Promise.resolve([]),
                    fetchLeagueRosters(targetLeagueId)
                ]);

                // 3. BUILD HISTORICAL OWNER MAP
                const historicalOwnerMap = {};
                // Source A: Draft Picks
                if (draftData) {
                    draftData.forEach(pick => {
                        if (pick.roster_id && pick.picked_by) {
                            historicalOwnerMap[pick.roster_id] = pick.picked_by;
                        }
                    });
                }
                // Source B: Week 1 Transactions
                if (transactionsData) {
                    transactionsData.forEach(t => {
                        if ((t.type === 'free_agent' || t.type === 'waiver') && t.creator && t.roster_ids) {
                            t.roster_ids.forEach(rid => {
                                historicalOwnerMap[rid] = t.creator;
                            });
                        }
                    });
                }
                console.log("Historical Owner Map constructed:", historicalOwnerMap);

                // Helper to resolve User
                const resolveUser = (rosterId) => {
                    if (historicalOwnerMap[rosterId]) {
                        return usersData.find(u => u.user_id === historicalOwnerMap[rosterId]);
                    }
                    const roster = rostersData.find(r => r.roster_id === rosterId);
                    if (roster && roster.owner_id) {
                        return usersData.find(u => u.user_id === roster.owner_id);
                    }
                    return null;
                };

                // --- CHAMPION LOGIC ---
                const maxRound = Math.max(...wBracket.map(m => m.r));
                const finalMatches = wBracket.filter(m => m.r === maxRound);
                const realChampMatch = finalMatches.find(m => !(m.t1_from?.l || m.t2_from?.l));

                if (realChampMatch && realChampMatch.w) {
                    const champUser = resolveUser(realChampMatch.w);
                    if (champUser) setChampion(champUser);
                }

                // --- TOILET BOWL LOGIC (Global Bracket Analysis) ---
                if (lBracket && lBracket.length > 0) {
                    // NEW STRATEGY V3: "The Plunger" Logic (Max Advances)
                    // Discovery: In a "Loser Advances" Toilet Bowl, Sleeper stores the Advancing Team (NFL Loser)
                    // in the 'w' (Winner) field of the bracket match object.
                    // Thus, the Ultimate Loser is the team with the MOST "Wins" (Advances) in the bracket.

                    const teamRecords = {};

                    lBracket.forEach(m => {
                        // Count 'Wins' (Advances)
                        if (m.w) {
                            if (!teamRecords[m.w]) teamRecords[m.w] = { id: m.w, wins: 0, losses: 0 };
                            teamRecords[m.w].wins++;
                        }
                        // Count 'Losses' (Escapes)
                        if (m.l) {
                            if (!teamRecords[m.l]) teamRecords[m.l] = { id: m.l, wins: 0, losses: 0 };
                            teamRecords[m.l].losses++;
                        }
                    });

                    // Convert to array for sorting
                    const candidates = Object.values(teamRecords);
                    console.log("[SeasonResults|Toilet] Global Bracket Stats:", candidates);

                    // SEARCH RULES:
                    // 1. Sort by Wins DESCENDING. (3 Wins = Played 3 Rounds and lost them all).
                    // 2. Tiebreaker: Most Losses? No, actually fewer escapes is worse? 
                    //    Actually, if you have 3 Wins, you reached the bitter end.

                    candidates.sort((a, b) => b.wins - a.wins);

                    const loserCandidate = candidates[0];
                    console.log("[SeasonResults|Toilet] Found Toilet Champ (Max Advances):", loserCandidate);

                    if (loserCandidate) {
                        const loserRosterId = loserCandidate.id;
                        console.log("Detected Loser Roster ID:", loserRosterId);

                        const resolvedUser = resolveUser(loserRosterId);
                        console.log("Resolved Historical User:", resolvedUser?.display_name);

                        if (resolvedUser) {
                            setToiletChamp(resolvedUser);

                            // Title Logic
                            if (targetLeagueData.metadata?.loser_trophy_name) setToiletTitle(targetLeagueData.metadata.loser_trophy_name);
                            else if (targetLeagueData.settings?.loser_trophy_name) setToiletTitle(targetLeagueData.settings.loser_trophy_name);
                            else setToiletTitle("The Toilet Bowl");
                        }
                    }
                }

            } catch (err) {
                console.error("Error loading season results:", err);
            } finally {
                setLoading(false);
            }
        };

        loadSeasonData();
    }, [league?.league_id]);

    if (loading || !champion || !toiletChamp) return null;

    return (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Champion Card */}
            <div className="relative overflow-hidden rounded-xl border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-950/40 to-slate-900/80 p-6 shadow-2xl shadow-yellow-900/20">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Crown className="h-32 w-32 text-yellow-500" />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="relative">
                        <div className="h-20 w-20 rounded-full border-4 border-yellow-500 shadow-lg overflow-hidden">
                            <img
                                src={avatarUrl(champion.avatar)}
                                alt="Champion"
                                className="h-full w-full object-cover"
                                onError={(e) => e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'}
                            />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-yellow-950 p-1.5 rounded-full shadow-lg">
                            <Trophy className="h-5 w-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-yellow-500 text-xs font-bold uppercase tracking-widest mb-1">
                            {league.season} League Champion
                        </div>
                        <h2 className="text-2xl font-black text-white leading-none">
                            {displayTeamName(champion)}
                        </h2>
                        <div className="mt-2 text-yellow-200/60 text-sm font-medium">
                            Glory is eternal.
                        </div>
                    </div>
                </div>
            </div>

            {/* Loser Card */}
            <div className="relative overflow-hidden rounded-xl border-2 border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-inner grayscale-[0.3]">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <div className="rotate-12 transform">
                        <Trash2 className="h-32 w-32 text-slate-500" />
                    </div>
                </div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="relative">
                        <div className="h-20 w-20 rounded-full border-4 border-slate-700 shadow-inner overflow-hidden grayscale">
                            <img
                                src={avatarUrl(toiletChamp.avatar)}
                                alt="Loser"
                                className="h-full w-full object-cover opacity-80"
                                onError={(e) => e.target.src = 'https://sleepercdn.com/images/v2/icons/player_default.webp'}
                            />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-slate-700 text-slate-300 p-1.5 rounded-full shadow-lg">
                            <Ghost className="h-5 w-5" />
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
                            {toiletTitle}
                        </div>
                        <h2 className="text-2xl font-black text-slate-300 leading-none decoration-slate-600 line-through decoration-2">
                            {displayTeamName(toiletChamp)}
                        </h2>
                        <div className="mt-2 text-slate-500 text-sm font-medium">
                            Better luck next year.
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default SeasonResultsBanner;
