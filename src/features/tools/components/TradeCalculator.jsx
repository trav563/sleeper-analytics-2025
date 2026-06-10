import { useState, useMemo, useRef, useEffect } from 'react';

import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Search, Plus, X, ArrowRightLeft, BarChart2, ChevronDown, Lightbulb } from 'lucide-react';
import { avatarUrl, displayTeamName } from '../../../utils/nflData';
import { useSleeper } from '../../../context/SleeperContext';
import { getTradeSuggestions, getTeamLifecycle } from '../../../utils/tradeLogic';
import ValueBadge from '../../../components/ui/ValueBadge';
import DynastyLandscape from './DynastyLandscape';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';



// --- HELPER: Generate Assets for a specific Roster ---
const getTeamAssets = (rosterId, rosters, players, league, tradedPicks, marketValues, users) => {
    if (!rosterId || !rosters || !players || !league) return [];

    const roster = rosters.find(r => r.roster_id === rosterId);
    if (!roster) return [];

    const assets = [];

    // 1. Players
    if (roster.players) {
        roster.players.forEach(pid => {
            const player = players[pid];
            if (player) {
                const isStarter = roster.starters?.includes(pid);
                // Check if Taxi/Reserve
                const isTaxi = roster.taxi?.includes(pid);
                const isReserve = roster.reserve?.includes(pid); // IR

                assets.push({
                    uniqueId: pid, // Using player_id as unique key for inventory list, but for trade list we generate random
                    type: 'Player',
                    ...player,
                    tradeValue: marketValues?.[pid] || 0,
                    group: isStarter ? 'Starters' : 'Bench',
                    status: isTaxi ? 'TAXI' : isReserve ? 'IR' : null
                });
            }
        });
    }

    // 2. Picks
    // We need to generate base picks and apply trades
    // Simplified logic: Create all picks, assign ownership to original roster, then apply trades.
    // Finally filter for THIS rosterId.
    const currentYear = parseInt(league.season);
    // Determine draft order rank for valuation (Simplified: Reverse MaxPF)
    // We need global roster list to sort.
    const sortedRosters = [...rosters].sort((a, b) => (b.settings?.ppts || 0) - (a.settings?.ppts || 0)); // High to Low PF

    // Generate ALL picks in league to track ownership correctly
    let allLeaguePicks = [];
    rosters.forEach(r => {
        [currentYear + 1, currentYear + 2, currentYear + 3].forEach(year => {
            [1, 2, 3].forEach(round => {
                allLeaguePicks.push({
                    id: `pick-${year}-${round}-${r.roster_id}`,
                    year,
                    round,
                    original_owner_id: r.roster_id,
                    roster_id: r.roster_id, // current owner
                    type: 'Pick'
                });
            });
        });
    });

    // Apply Trades
    if (tradedPicks) {
        tradedPicks.forEach(tp => {
            const year = parseInt(tp.season);
            const match = allLeaguePicks.find(p =>
                p.year === year &&
                p.round === tp.round &&
                p.original_owner_id === tp.roster_id
            );
            if (match) {
                match.roster_id = tp.owner_id;
            }
        });
    }

    // Filter for Selected Roster
    const myPicks = allLeaguePicks.filter(p => p.roster_id === rosterId);

    // Value Picks
    const totalTeams = rosters.length;
    myPicks.forEach(p => {
        // Find Rank of Original Owner
        // If original owner has low MaxPF -> Early Pick
        const originalOwnerIdx = sortedRosters.findIndex(r => r.roster_id === p.original_owner_id);
        // sortedRosters is High to Low. 
        // Index 0 = Best Team = Late Pick.
        // Index Last = Worst Team = Early Pick.
        // Rank 1 = Worst Team.
        // So Rank = totalTeams - index.
        const rank = originalOwnerIdx !== -1 ? (totalTeams - originalOwnerIdx) : 6;

        // Simple Valuation (Approximate)
        let val = 150;
        if (p.round === 1) {
            if (rank <= 3) val = 7000;
            else if (rank <= 8) val = 5500;
            else val = 4500;
        } else if (p.round === 2) {
            if (rank <= 4) val = 2800;
            else if (rank <= 8) val = 2200;
            else val = 1600;
        } else if (p.round === 3) {
            val = 600;
        }

        p.tradeValue = val;

        let qual = 'Mid';
        if (rank <= 4) qual = 'Early';
        else if (rank >= 9) qual = 'Late';

        p.full_name = `${p.year} ${p.round === 1 ? '1st' : p.round === 2 ? '2nd' : '3rd'} (${qual})`;
        p.group = 'Draft Picks';
        p.uniqueId = p.id;
        p.team = `via ${displayTeamName(users.find(u => u.user_id === rosters.find(r => r.roster_id === p.original_owner_id)?.owner_id))}`;
    });

    assets.push(...myPicks);

    return assets.sort((a, b) => b.tradeValue - a.tradeValue);
};

// --- ASSET SELECTOR COMPONENT ---
const AssetSelector = ({ rosterId, onAdd, assets, placeholder, takenIds }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredAssets = useMemo(() => {
        let result = assets;

        // 1. Filter Check (Search)
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(a =>
                (a.full_name || '').toLowerCase().includes(q) ||
                (a.position || '').toLowerCase().includes(q)
            );
        }

        // 2. Duplicate Check
        if (takenIds) {
            result = result.filter(a => !takenIds.has(a.uniqueId));
        }

        return result;
    }, [assets, search, takenIds]);

    const groups = ['Starters', 'Bench', 'Draft Picks'];

    if (!rosterId) {
        return (
            <div className="w-full bg-slate-800/50 border border-slate-700 border-dashed rounded p-3 text-center text-slate-500 text-sm italic">
                Select a team above to view assets
            </div>
        );
    }

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="w-full bg-slate-800 border-slate-700 rounded pl-8 pr-2 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 bg-slate-800 border border-slate-700 z-50 rounded-b shadow-xl max-h-[300px] overflow-y-auto mt-1">
                    {filteredAssets.length === 0 ? (
                        <div className="p-3 text-slate-500 text-xs text-center">No assets found</div>
                    ) : (
                        groups.map(group => {
                            const groupAssets = filteredAssets.filter(a => a.group === group);
                            if (groupAssets.length === 0) return null;
                            return (
                                <div key={group}>
                                    <div className="sticky top-0 bg-slate-900/90 backdrop-blur px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
                                        {group}
                                    </div>
                                    {groupAssets.map(asset => (
                                        <div
                                            key={asset.uniqueId}
                                            className="p-2 hover:bg-slate-700 cursor-pointer flex justify-between items-center border-b border-slate-700/30 last:border-0"
                                            onClick={() => {
                                                onAdd(asset);
                                                setIsOpen(false);
                                                setSearch('');
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-white font-bold">{asset.full_name}</span>
                                                    {asset.status && <span className="text-[9px] bg-red-500/20 text-red-300 px-1 rounded border border-red-500/20">{asset.status}</span>}
                                                </div>
                                                <span className="text-[10px] text-slate-400">{asset.position} {asset.team ? `• ${asset.team}` : ''}</span>
                                            </div>
                                            <span className="text-xs font-mono text-green-400">{asset.tradeValue?.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

const TradeCalculator = ({ rosters, users, players, league, state, tradedPicks }) => {
    const [marketValues, setMarketValues] = useState({});

    // Internal Data Fetching (Self-Sufficient)
    useEffect(() => {
        const fetchPrices = async () => {
            const isSuperflex = league?.roster_positions?.includes('SUPER_FLEX');
            const numTeams = users?.length || 12;

            try {
                // FIX: Use the full absolute URL, not the relative /api path
                const res = await fetch(`https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${isSuperflex ? 2 : 1}&numTeams=${numTeams}&ppr=0.5`);

                if (!res.ok) throw new Error('Network response was not ok');

                const data = await res.json();
                const valueMap = {};

                // Transform Array -> Map for fast lookup
                if (Array.isArray(data)) {
                    data.forEach(p => {
                        // Robust ID check: specific FantasyCalc endpoint might nest IDs
                        const pid = p.sleeperId || p.player?.sleeperId;
                        if (pid) valueMap[pid] = p.value;
                    });
                }

                setMarketValues(valueMap);
                console.log("✅ TradeSandbox: Internal Price List Loaded:", Object.keys(valueMap).length);
            } catch (err) {
                console.error("❌ TradeSandbox: Failed to fetch prices", err);
            }
        };

        if (league && users) fetchPrices();
    }, [league, users]);

    const [sideA, setSideA] = useState({ name: 'Team A', assets: [] });
    const [sideB, setSideB] = useState({ name: 'Team B', assets: [] });
    const [selectedRosterA, setSelectedRosterA] = useState(null);
    const [selectedRosterB, setSelectedRosterB] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // Memoize Assets for Selected Rosters
    const assetsA = useMemo(() => getTeamAssets(selectedRosterA, rosters, players, league, tradedPicks, marketValues, users), [selectedRosterA, rosters, players, league, tradedPicks, marketValues, users]);
    const assetsB = useMemo(() => getTeamAssets(selectedRosterB, rosters, players, league, tradedPicks, marketValues, users), [selectedRosterB, rosters, players, league, tradedPicks, marketValues, users]);

    // Calculate "Taken" IDs to prevent duplicates
    const getStableId = (a) => a.type === 'Pick' ? a.id : a.player_id;
    const takenIds = useMemo(() => new Set(
        [...sideA.assets, ...sideB.assets].map(getStableId)
    ), [sideA.assets, sideB.assets]);

    // Compute Smart Suggestions
    const tradeSuggestions = useMemo(() => {
        if (!selectedRosterA || !selectedRosterB || !rosters) return null;
        const rA = rosters.find(r => r.roster_id === selectedRosterA);
        const rB = rosters.find(r => r.roster_id === selectedRosterB);
        if(!rA || !rB) return null;
        return getTradeSuggestions(rA, rB, assetsA, assetsB, rosters);
    }, [selectedRosterA, selectedRosterB, assetsA, assetsB, rosters]);

    const [debugLog, setDebugLog] = useState(null);

    const addAsset = (setSide, asset) => {
        // Re-hydrate value from live market data if available (fixes 0 value bug)
        let finalValue = asset.tradeValue;
        if (asset.type === 'Player' && marketValues?.[asset.player_id]) {
            finalValue = marketValues[asset.player_id];
        }

        setSide(prev => ({ ...prev, assets: [...prev.assets, { ...asset, tradeValue: finalValue, uniqueId: Math.random() }] }));
    };

    const removeAsset = (setSide, uniqueId) => {
        setSide(prev => ({ ...prev, assets: prev.assets.filter(a => a.uniqueId !== uniqueId) }));
    };

    // --- CALCULATIONS ---
    const totalA = sideA.assets.reduce((sum, a) => sum + (a.tradeValue || 0), 0);
    const totalB = sideB.assets.reduce((sum, a) => sum + (a.tradeValue || 0), 0);
    const diff = totalA - totalB;
    const absDiff = Math.abs(diff);
    const maxTotal = Math.max(totalA, totalB, 1);
    const percentDiff = (absDiff / maxTotal) * 100;

    let fairnessColor = 'bg-green-500';
    let fairnessText = 'Fair Trade';
    if (percentDiff > 20) {
        fairnessColor = 'bg-red-500';
        fairnessText = 'Unfair';
    } else if (percentDiff > 5) {
        fairnessColor = 'bg-yellow-500';
        fairnessText = 'Leans ' + (totalA > totalB ? 'Side A' : 'Side B');
    }

    // --- SIMULATION LOGIC ---
    const effectiveSimulatedRosters = useMemo(() => {
        if (!isSimulating || !rosters) return [];
        const cloned = JSON.parse(JSON.stringify(rosters));

        if (selectedRosterA) {
            const rosterA = cloned.find(r => r.roster_id === selectedRosterA);
            if (rosterA) {
                const assetsGained = sideA.assets.map(a => a.player_id).filter(Boolean); // Received
                // Logic: In "Side A" column, user adds assets they GET? Or assets they GIVE?
                // Standard Calculator: "Side A" = "Assets Side A GETS".
                // WAIT. In the UI I built: "Vs Side B"
                // Usually calculator: Left is Team A, Right is Team B.
                // Left Box = Assets FROM Team B TO Team A? Or Assets Team A HAS?
                // Standard KTC/FantasyCalc:
                // Column A = "Team A receives..."
                // But my UI has "Select Team A" at the top of the column.
                // If I select "Team A" and then search "Bijan"...
                // Does it mean Team A *Has* Bijan and is GIVING him? Or Team A is GETTING Bijan?
                // The "Team Aware Search" implies I am searching Team A's inventory.
                // THEREFORE: The items in Column A are items Team A *Currently Owns*.
                // WHICH MEANS: In the trade, Team A is GIVING these items.
                // So... Side A Column = Assets A GIVES.
                // Side B Column = Assets B GIVES.

                // SO:
                // Roster A loses Assets in Column A.
                // Roster A gains Assets in Column B.

                // Check previous implementation attempt:
                // "assetsGained = sideA.assets" -> No, that was confusing.
                // Let's stick to the "Inventory" logic:
                // I select Team A. I see Team A's players. I pick Bijan. Bijan appears in Column A.
                // Why would I pick Bijan? To trade him AWAY.
                // So Assets A = GIVEN by A.

                const assetsGiven = sideA.assets.map(a => a.player_id).filter(Boolean);
                const assetsReceived = sideB.assets.map(a => a.player_id).filter(Boolean); // From B

                rosterA.players = rosterA.players.filter(pid => !assetsGiven.includes(pid));
                rosterA.players.push(...assetsReceived);
            }
        }

        if (selectedRosterB) {
            const rosterB = cloned.find(r => r.roster_id === selectedRosterB);
            if (rosterB) {
                const assetsGiven = sideB.assets.map(a => a.player_id).filter(Boolean);
                const assetsReceived = sideA.assets.map(a => a.player_id).filter(Boolean); // From A

                rosterB.players = rosterB.players.filter(pid => !assetsGiven.includes(pid));
                rosterB.players.push(...assetsReceived);
            }
        }

        return cloned;
    }, [isSimulating, rosters, sideA, sideB, selectedRosterA, selectedRosterB]);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                    Trade Sandbox
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                    {/* VS Badge */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex flex-col items-center">
                        <div className="bg-slate-800 border border-slate-600 rounded-full p-2">
                            <span className="font-black text-slate-400 text-xs text-center leading-tight">GIVES<br />TO</span>
                        </div>
                    </div>

                    {/* SIDE A */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <select
                                className="bg-slate-800 text-white text-sm border border-slate-700 rounded p-1 max-w-[150px]"
                                onChange={(e) => {
                                    setSelectedRosterA(e.target.value ? parseInt(e.target.value) : null);
                                    setSideA(prev => ({ ...prev, assets: [] })); // Clear on switch
                                }}
                            >
                                <option value="">Select Team A</option>
                                {(rosters || []).map(r => (
                                    <option key={r.roster_id} value={r.roster_id}>
                                        {displayTeamName(users.find(u => u.user_id === r.owner_id))}
                                    </option>
                                ))}
                            </select>
                            <span className="text-2xl font-bold font-mono text-blue-300">{totalA.toLocaleString()}</span>
                        </div>

                        {/* Asset List */}
                        <div className="min-h-[150px] bg-slate-800/50 rounded-lg p-3 space-y-2 border border-slate-700/50">
                            {sideA.assets.map(asset => (
                                <div key={asset.uniqueId} className="flex items-center justify-between bg-slate-700/50 p-2 rounded">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">{asset.full_name}</span>
                                            <span className="text-[10px] text-slate-400">{asset.position} {asset.team ? `• ${asset.team}` : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <ValueBadge value={asset.tradeValue} isPick={asset.type === 'Pick'} />
                                        <button onClick={() => removeAsset(setSideA, asset.uniqueId)} className="text-slate-500 hover:text-red-400">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {sideA.assets?.length === 0 && <div className="text-center text-slate-600 text-xs py-10 italic">Select assets to GIVE</div>}
                        </div>

                        {/* Search -> Now AssetSelector */}
                        <AssetSelector
                            rosterId={selectedRosterA}
                            assets={assetsA}
                            onAdd={(asset) => addAsset(setSideA, asset)}
                            placeholder="Add Asset from Team A..."
                            takenIds={takenIds}
                        />
                    </div>

                    {/* SIDE B */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <select
                                className="bg-slate-800 text-white text-sm border border-slate-700 rounded p-1 max-w-[150px]"
                                onChange={(e) => {
                                    setSelectedRosterB(e.target.value ? parseInt(e.target.value) : null);
                                    setSideB(prev => ({ ...prev, assets: [] }));
                                }}
                            >
                                <option value="">Select Team B</option>
                                {(rosters || []).map(r => (
                                    <option key={r.roster_id} value={r.roster_id}>
                                        {displayTeamName(users.find(u => u.user_id === r.owner_id))}
                                    </option>
                                ))}
                            </select>
                            <span className="text-2xl font-bold font-mono text-blue-300">{totalB.toLocaleString()}</span>
                        </div>

                        <div className="min-h-[150px] bg-slate-800/50 rounded-lg p-3 space-y-2 border border-slate-700/50">
                            {sideB.assets.map(asset => (
                                <div key={asset.uniqueId} className="flex items-center justify-between bg-slate-700/50 p-2 rounded">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">{asset.full_name}</span>
                                            <span className="text-[10px] text-slate-400">{asset.position} {asset.team ? `• ${asset.team}` : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <ValueBadge value={asset.tradeValue} isPick={asset.type === 'Pick'} />
                                        <button onClick={() => removeAsset(setSideB, asset.uniqueId)} className="text-slate-500 hover:text-red-400">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {sideB.assets?.length === 0 && <div className="text-center text-slate-600 text-xs py-10 italic">Select assets to GIVE</div>}
                        </div>

                        <AssetSelector
                            rosterId={selectedRosterB}
                            assets={assetsB}
                            onAdd={(asset) => addAsset(setSideB, asset)}
                            placeholder="Add Asset from Team B..."
                            takenIds={takenIds}
                        />
                    </div>
                </div>

                {/* Smart Suggestions Panel */}
                {tradeSuggestions && (tradeSuggestions.targetsForA.length > 0 || tradeSuggestions.targetsForB.length > 0) && (
                    <div className="mt-6 bg-blue-950/30 border border-blue-900/50 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-4 h-4 text-blue-400" />
                            <h3 className="text-sm font-bold text-blue-200">Smart Target Suggestions</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Team A Targets (From B's Assets) */}
                            {tradeSuggestions.targetsForA.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-blue-400 font-medium">Auto-add to Side B:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {tradeSuggestions.targetsForA.map(target => (
                                            <button 
                                                key={target.uniqueId}
                                                disabled={takenIds.has(getStableId(target))}
                                                onClick={() => addAsset(setSideB, target)}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-3 h-3" />
                                                {target.full_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Team B Targets (From A's Assets) */}
                            {tradeSuggestions.targetsForB.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-blue-400 font-medium">Auto-add to Side A:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {tradeSuggestions.targetsForB.map(target => (
                                            <button 
                                                key={target.uniqueId}
                                                disabled={takenIds.has(getStableId(target))}
                                                onClick={() => addAsset(setSideA, target)}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-3 h-3" />
                                                {target.full_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Fairness Meter */}
                <div className="mt-8 mb-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-2 uppercase font-bold tracking-wider">
                        <span>Side A</span>
                        <span className={fairnessColor.replace('bg-', 'text-')}>{fairnessText} ({Math.round(percentDiff)}%)</span>
                        <span>Side B</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 z-10" />
                        <div
                            className={`h-full transition-all duration-500 ${fairnessColor}`}
                            style={{
                                width: `${Math.min(percentDiff, 50)}%`,
                                marginLeft: totalA > totalB ? '50%' : `calc(50% - ${Math.min(percentDiff, 50)}%)`
                            }}
                        />
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-2">
                        Diff: <span className="text-white font-mono">{Math.abs(diff).toLocaleString()}</span>
                        {diff !== 0 && <span className="ml-1 text-[10px] opacity-70">({diff > 0 ? 'A' : 'B'} needs to add)</span>}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex justify-center mt-6">
                    <Button
                        onClick={() => setIsSimulating(true)}
                        disabled={(!selectedRosterA && !selectedRosterB)}
                        className="bg-purple-600 hover:bg-purple-500 gap-2"
                    >
                        <BarChart2 className="w-4 h-4" />
                        Simulate Landscape Impact
                    </Button>
                </div>
            </CardContent>

            {/* Simulation Modal */}
            <Dialog open={isSimulating} onOpenChange={setIsSimulating}>
                <DialogContent className="max-w-4xl bg-slate-900 border-slate-800">
                    <DialogHeader>
                        <DialogTitle>Simulated Dynasty Landscape</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <DynastyLandscape
                            rosters={effectiveSimulatedRosters}
                            users={users}
                            players={players}
                            league={league}
                            state={state}
                        />
                        <p className="text-center text-xs text-slate-500 mt-4">
                            *Visualizes how the Age/Value profile changes. (Moves assets from Giver to Receiver).
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </Card >
    );
};

export default TradeCalculator;
