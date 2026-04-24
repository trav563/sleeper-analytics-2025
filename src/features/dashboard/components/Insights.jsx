import { Sliders, ClipboardList, Search, Trophy } from 'lucide-react';
import CoachCard from './CoachCard';

const HOUR = 60 * 60 * 1000;

const TOOLS = [
    {
        icon: Sliders,
        title: 'Optimize Lineup',
        description: 'AI · This week',
        analysisType: 'lineup',
        cooldownMs: 4 * HOUR,
        constraints: [
            { value: 'ceiling', label: 'Higher ceiling' },
            { value: 'floor', label: 'Higher floor' },
            { value: 'stack', label: 'Stack with QB' },
        ],
    },
    {
        icon: ClipboardList,
        title: 'Rate My Roster',
        description: 'AI · Position grades',
        analysisType: 'roster',
        cooldownMs: 24 * HOUR,
        constraints: [
            { value: 'trade-up', label: 'Trade-up ideas' },
            { value: 'sell-high', label: 'Sell-high candidates' },
        ],
    },
    {
        icon: Search,
        title: 'Waiver Targets',
        description: 'AI · League-wide',
        analysisType: 'waivers',
        cooldownMs: 12 * HOUR,
        constraints: [
            { value: 'low-rostered', label: 'Under 25% rostered' },
            { value: 'streamers', label: 'Streaming DEF/K only' },
        ],
    },
    {
        icon: Trophy,
        title: 'Playoff Path',
        description: 'AI · Season outlook',
        analysisType: 'playoff',
        cooldownMs: 24 * HOUR,
        constraints: [
            { value: 'compete', label: 'Compete-now strategy' },
            { value: 'build', label: 'Build-for-future' },
        ],
    },
];

const Insights = ({ leagueId, userId, week }) => {
    if (!leagueId || !userId || !week) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TOOLS.map((t) => (
                <CoachCard
                    key={t.analysisType}
                    icon={t.icon}
                    title={t.title}
                    description={t.description}
                    leagueId={leagueId}
                    userId={userId}
                    week={week}
                    analysisType={t.analysisType}
                    cooldownMs={t.cooldownMs}
                    constraints={t.constraints}
                />
            ))}
        </div>
    );
};

export default Insights;
