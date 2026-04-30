import { Link, useParams } from 'react-router-dom';
import { Trophy, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import DraftOrderGrid from './DraftOrderGrid';
import MyDraftRoster from './MyDraftRoster';
import { Badge } from '../../../components/ui/Badge';
import { draftTypeLabel } from '../utils/draftTypeDetect';

export default function PostDraftView({ draft, picks, players, rosters, users, userId, draftType, onPlayerClick }) {
    const { leagueId } = useParams();
    const userSlot = userId ? draft?.draft_order?.[userId] : null;
    const totalPicks = picks?.length || 0;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-good/40 bg-gradient-to-r from-good/30 to-bg-1/40 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Badge variant="outline" className="mb-2">{draftTypeLabel(draftType)}</Badge>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-good" />
                            Draft Complete
                        </h2>
                        <p className="text-sm text-text-mute mt-1">
                            {totalPicks} total picks · Your slot: #{userSlot ?? '—'}
                        </p>
                    </div>
                    <Link to={`/league/${leagueId}`}>
                        <Button>
                            Open Dashboard
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1">
                    <MyDraftRoster
                        picks={picks}
                        players={players}
                        userSlot={userSlot}
                        draftType={draftType}
                        onPlayerClick={onPlayerClick}
                    />
                </div>
                <div className="xl:col-span-2">
                    <DraftOrderGrid
                        draft={draft}
                        picks={picks}
                        rosters={rosters}
                        users={users}
                        userId={userId}
                        currentPickNo={null}
                    />
                </div>
            </div>
        </div>
    );
}
