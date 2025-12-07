```javascript
import { useMemo, useState, useRef } from 'react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Download, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import QRCode from 'react-qr-code';

const TankTracker = ({ rosters, users, tradedPicks, league }) => {
    const [selectedRound, setSelectedRound] = useState(1);
    const captureRef = useRef(null);
    const [generating, setGenerating] = useState(false);

    const projectedOrder = useMemo(() => {
        if (!rosters || rosters.length === 0) return [];

        // 1. Determine "Natural" Slots based on Max PF (ppts)
        const sorted = [...rosters].sort((a, b) => {
            const maxPfA = (a.settings?.ppts || 0) + (a.settings?.ppts_decimal || 0) / 100;
            const maxPfB = (b.settings?.ppts || 0) + (b.settings?.ppts_decimal || 0) / 100;
            return maxPfA - maxPfB;
        });

        // 2. Check Ownership for Selected Round
        const nextDraftYear = (parseInt(league?.season || '2025') + 1).toString();

        return sorted.map((roster, index) => {
            const originalOwnerId = roster.roster_id;
            const originalOwner = users.find(u => u.user_id === roster.owner_id);
            const maxPf = (roster.settings?.ppts || 0) + (roster.settings?.ppts_decimal || 0) / 100;

            const tradeEntry = tradedPicks?.find(p => 
                p.roster_id === originalOwnerId && 
                p.round === selectedRound && 
                p.season === nextDraftYear
            );

            let currentOwnerId = originalOwnerId;
            let currentOwner = originalOwner;
            let isTraded = false;

            if (tradeEntry) {
                currentOwnerId = tradeEntry.owner_id; // Receiver of the pick
                const currentRoster = rosters.find(r => r.roster_id === currentOwnerId);
                currentOwner = users.find(u => u.user_id === currentRoster?.owner_id);
                isTraded = true;
            }

            return {
                pick: `${ selectedRound }.${ String(index + 1).padStart(2, '0') } `,
                originalOwner,
                currentOwner,
                maxPf: maxPf.toFixed(2),
                isTraded
            };
        });

    }, [rosters, users, tradedPicks, league, selectedRound]);

    const downloadImage = async () => {
        if (captureRef.current) {
            setGenerating(true);
            try {
                // Wait a tick to ensure styles are applied if needed
                await new Promise(resolve => setTimeout(resolve, 100));
                const dataUrl = await toPng(captureRef.current, { 
                    cacheBust: true, 
                    backgroundColor: '#0f172a',
                    pixelRatio: 2 // High quality
                });
                const link = document.createElement('a');
                link.download = `tank - tracker - round - ${ selectedRound }.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Failed to generate image', err);
            } finally {
                setGenerating(false);
            }
        }
    };

    if (!rosters || rosters.length === 0) return null;

    const leagueUrl = window.location.href; // Or standard URL

    return (
        <div className="space-y-4">
            {/* Controls Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    {[1, 2, 3].map(round => (
                        <button
                            key={round}
                            onClick={() => setSelectedRound(round)}
                            className={`px - 4 py - 1.5 rounded - md text - sm font - medium transition - all ${
    selectedRound === round
        ? 'bg-blue-600 text-white shadow-lg'
        : 'text-slate-400 hover:text-white hover:bg-slate-700'
} `}
                        >
                            Round {round}
                        </button>
                    ))}
                </div>

                <Button onClick={downloadImage} className="gap-2" disabled={generating}>
                    {generating ? 'Capturing...' : <><Camera className="w-4 h-4" /> Share Order</>}
                </Button>
            </div>

            {/* Capture Container */}
            <div ref={captureRef} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                <div className="p-6 pb-0">
                     <div className="flex justify-between items-end mb-6">
                        <div>
                             <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <span className="text-3xl">🚜</span> Tank Tracker
                            </h2>
                            <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-bold">
                                Projected {league?.season ? parseInt(league.season) + 1 : 'Next'} Rookie Draft • Round {selectedRound}
                            </p>
                        </div>
                        {/* Only show league name in capture if desired, or always? Always looks good. */}
                        <div className="text-right hidden sm:block">
                             <div className="text-sm font-bold text-slate-500">{league?.name}</div>
                        </div>
                     </div>
                </div>

                <div className="px-6">
                    <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-300">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-700">
                                        <tr>
                                            <th className="px-4 py-3">Pick</th>
                                            <th className="px-4 py-3">Current Owner</th>
                                            <th className="px-4 py-3 text-right">Max PF</th>
                                            <th className="px-4 py-3 max-w-[150px] hidden sm:table-cell">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {projectedOrder.map((row) => (
                                            <tr key={row.pick} className={`group ${ row.isTraded ? 'bg-blue-500/10' : 'hover:bg-slate-800/50' } `}>
                                                <td className="px-4 py-3 font-mono font-bold text-white">{row.pick}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                             <img src={avatarUrl(row.currentOwner?.avatar)} className="w-8 h-8 rounded-full border border-slate-600" />
                                                             {row.isTraded && (
                                                                 <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-900"></div>
                                                             )}
                                                        </div>
                                                        <div>
                                                            <div className={`font - bold ${ row.isTraded ? 'text-blue-300' : 'text-slate-200' } `}>
                                                                {displayTeamName(row.currentOwner)}
                                                            </div>
                                                            {row.isTraded && (
                                                                <div className="text-[10px] text-blue-400/70 uppercase tracking-wider font-bold sm:hidden">
                                                                    via {displayTeamName(row.originalOwner)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-400 group-hover:text-white transition-colors">
                                                    {row.maxPf}
                                                </td>
                                                <td className="px-4 py-3 hidden sm:table-cell">
                                                    {row.isTraded ? (
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">VIA</span>
                                                            <div className="flex items-center gap-1.5 opacity-75">
                                                                <img src={avatarUrl(row.originalOwner?.avatar)} className="w-4 h-4 rounded-full" />
                                                                <span className="truncate max-w-[100px]">{displayTeamName(row.originalOwner)}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-700 font-medium tracking-wider">ORIGINAL</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Viral Footer */}
                <div className="p-6 mt-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Analysis Powered By</p>
                        <p className="text-xl font-black italic bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">DYNASTY LENS</p>
                    </div>
                    <div className="bg-white p-1.5 rounded shadow-lg">
                        <QRCode
                            size={48}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            value={leagueUrl}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TankTracker;
```
