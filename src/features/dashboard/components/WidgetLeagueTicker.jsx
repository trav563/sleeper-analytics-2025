import { useMemo } from 'react';
import { ArrowRightLeft, PlusCircle, MinusCircle } from 'lucide-react';

const WidgetLeagueTicker = ({ transactions }) => {
    // Mock transactions if none provided (API for transactions not yet hooked up in LeagueLayout)
    const recentActivity = useMemo(() => {
        return [
            { type: 'trade', desc: 'Team A traded Justin Jefferson to Team B', time: '2h ago' },
            { type: 'add', desc: 'Team C added Puka Nacua', time: '4h ago' },
            { type: 'drop', desc: 'Team D dropped Cam Akers', time: '5h ago' },
        ];
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'trade': return <ArrowRightLeft className="w-4 h-4 text-purple-400" />;
            case 'add': return <PlusCircle className="w-4 h-4 text-green-400" />;
            case 'drop': return <MinusCircle className="w-4 h-4 text-red-400" />;
            default: return null;
        }
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">League Activity</h3>
            <div className="space-y-4">
                {recentActivity.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-3 border-b border-slate-700/50 last:border-0 last:pb-0">
                        <div className="mt-0.5">{getIcon(item.type)}</div>
                        <div>
                            <p className="text-sm text-slate-200 leading-tight">{item.desc}</p>
                            <p className="text-xs text-slate-500 mt-1">{item.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WidgetLeagueTicker;
