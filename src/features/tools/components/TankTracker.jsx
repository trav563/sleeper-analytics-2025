import { useMemo, useState, useRef } from 'react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Button } from '../../../components/ui/Button';
import { Camera, Truck } from 'lucide-react';
import { toPng } from 'html-to-image';
import QRCode from 'react-qr-code';
import { Pip } from '../../../components/ui/Pip';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';
import { theme } from '../../../lib/theme';

const TankTracker = ({ rosters, users, tradedPicks, league }) => {
    const [selectedRound, setSelectedRound] = useState(1);
    const captureRef = useRef(null);
    const [generating, setGenerating] = useState(false);

    const projectedOrder = useMemo(() => {
        if (!rosters || rosters.length === 0) return [];

        const sorted = [...rosters].sort((a, b) => {
            const maxPfA = (a.settings?.ppts || 0) + (a.settings?.ppts_decimal || 0) / 100;
            const maxPfB = (b.settings?.ppts || 0) + (b.settings?.ppts_decimal || 0) / 100;
            return maxPfA - maxPfB;
        });

        const nextDraftYear = (parseInt(league?.season || '2025') + 1).toString();

        return sorted.map((roster, index) => {
            const originalRosterId = roster.roster_id;
            const originalOwner = users.find(u => u.user_id === roster.owner_id);
            const maxPf = (roster.settings?.ppts || 0) + (roster.settings?.ppts_decimal || 0) / 100;

            const tradeEntry = tradedPicks?.find(p =>
                p.roster_id === originalRosterId &&
                p.round === selectedRound &&
                p.season === nextDraftYear
            );

            let currentRosterId = originalRosterId;
            let currentOwner = originalOwner;
            let isTraded = false;

            if (tradeEntry) {
                // In Sleeper's traded_picks payload, owner_id is the acquiring
                // ROSTER id (not a user id).
                currentRosterId = tradeEntry.owner_id;
                const currentRoster = rosters.find(r => r.roster_id === currentRosterId);
                currentOwner = users.find(u => u.user_id === currentRoster?.owner_id);
                isTraded = true;
            }

            return {
                pick: `${selectedRound}.${String(index + 1).padStart(2, '0')}`,
                originalOwner,
                currentOwner,
                originalRosterId,
                currentRosterId,
                maxPf: maxPf.toFixed(2),
                isTraded
            };
        });
    }, [rosters, users, tradedPicks, league, selectedRound]);

    const downloadImage = async () => {
        if (captureRef.current) {
            setGenerating(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 100));
                const dataUrl = await toPng(captureRef.current, {
                    cacheBust: true,
                    backgroundColor: theme.color.bg,
                    pixelRatio: 2,
                });
                const link = document.createElement('a');
                link.download = `tank-tracker-round-${selectedRound}.png`;
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

    const leagueUrl = window.location.href;

    return (
        <section className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <Truck className="w-3 h-3 text-signal" aria-hidden="true" />
                        Tool · Tank Tracker
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-text">
                        Projected {league?.season ? parseInt(league.season) + 1 : 'Next'} Rookie Draft
                    </h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                    <SegmentedTabs
                        tabs={[
                            { value: 1, label: 'Round 1' },
                            { value: 2, label: 'Round 2' },
                            { value: 3, label: 'Round 3' },
                        ]}
                        value={selectedRound}
                        onChange={setSelectedRound}
                    />
                    <Button
                        onClick={downloadImage}
                        disabled={generating}
                        className="gap-2 bg-signal text-ink font-semibold hover:bg-signal/90 min-h-[40px]"
                    >
                        {generating ? 'Capturing…' : <><Camera className="w-4 h-4" /> Share Order</>}
                    </Button>
                </div>
            </div>

            <div ref={captureRef} className="bg-bg rounded-xl overflow-hidden border border-line shadow-pop">
                <div className="p-5 pb-0">
                    <div className="flex justify-between items-end mb-5 gap-3">
                        <div className="min-w-0">
                            <h2 className="font-display text-2xl font-bold text-text flex items-center gap-2">
                                Tank Tracker
                            </h2>
                            <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                                <span className="tnum">{league?.season ? parseInt(league.season) + 1 : 'Next'}</span> Rookie Draft · Round <span className="tnum text-signal">{selectedRound}</span>
                            </p>
                        </div>
                        <div className="text-right hidden sm:block min-w-0">
                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute truncate">{league?.name}</div>
                        </div>
                    </div>
                </div>

                <div className="px-5">
                    <div className="bg-bg-1 border border-line rounded-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2 border-b border-line">
                                        <th className="px-4 py-2.5">Pick</th>
                                        <th className="px-4 py-2.5">Current Owner</th>
                                        <th className="px-4 py-2.5 text-right">Max PF</th>
                                        <th className="px-4 py-2.5 hidden sm:table-cell">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectedOrder.map((row) => (
                                        <tr
                                            key={row.pick}
                                            className={`group border-b border-line/60 ${row.isTraded ? 'bg-signal/8' : 'hover:bg-bg-2/60'} transition-colors duration-fast`}
                                        >
                                            <td className="px-4 py-3 font-mono font-bold text-text tnum">{row.pick}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                        {row.currentOwner?.avatar ? (
                                                            <img
                                                                src={avatarUrl(row.currentOwner.avatar)}
                                                                alt=""
                                                                className="w-8 h-8 rounded-full ring-1 ring-line"
                                                            />
                                                        ) : (
                                                            <Pip seed={row.currentRosterId ?? 'team'} name={displayTeamName(row.currentOwner)} size={32} />
                                                        )}
                                                        {row.isTraded && (
                                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-signal rounded-full ring-2 ring-bg" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`font-semibold truncate ${row.isTraded ? 'text-signal' : 'text-text'}`}>
                                                            {displayTeamName(row.currentOwner)}
                                                        </div>
                                                        {row.isTraded && (
                                                            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute sm:hidden">
                                                                via {displayTeamName(row.originalOwner)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-text-dim group-hover:text-text transition-colors duration-fast tnum">
                                                {row.maxPf}
                                            </td>
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                {row.isTraded ? (
                                                    <div className="flex items-center gap-2 text-xs text-text-mute">
                                                        <span className="bg-bg-3 border border-line text-text-mute px-1.5 py-0.5 rounded-sm font-mono text-2xs uppercase tracking-wider">VIA</span>
                                                        <div className="flex items-center gap-1.5">
                                                            {row.originalOwner?.avatar ? (
                                                                <img src={avatarUrl(row.originalOwner.avatar)} alt="" className="w-4 h-4 rounded-full" />
                                                            ) : (
                                                                <Pip seed={row.originalRosterId ?? 'orig'} name={displayTeamName(row.originalOwner)} size={16} />
                                                            )}
                                                            <span className="truncate max-w-[120px]">{displayTeamName(row.originalOwner)}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="font-mono text-2xs text-text-mute uppercase tracking-wider">Original</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-5 mt-4 bg-bg-1 border-t border-line flex items-center justify-between">
                    <div>
                        <p className="font-mono text-2xs text-text-mute uppercase tracking-wider mb-0.5">Powered By</p>
                        <p
                            className="font-display text-xl font-black italic"
                            style={{
                                background: 'linear-gradient(90deg, var(--signal), var(--signal-2))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            LEAGUE ANALYSIS
                        </p>
                    </div>
                    <div className="bg-white p-1.5 rounded shadow-pop">
                        <QRCode
                            size={48}
                            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                            value={leagueUrl}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TankTracker;
