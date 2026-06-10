import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';
import { getPickEquivalent } from '../../utils/fantasyCalc';

const ValueBadge = ({ value, isPick = false }) => {
    const { label, color, tier } = getPickEquivalent(value);

    // Determine range for tooltip
    let range = "< 1000";
    if (tier.includes('High 1st')) range = "8000+";
    else if (tier.includes('Mid 1st')) range = "6000 - 7999";
    else if (tier.includes('Late 1st')) range = "5000 - 5999";
    else if (tier.includes('Early 2nd')) range = "3500 - 4999";
    else if (tier.includes('Mid 2nd')) range = "2000 - 3499";
    else if (tier.includes('3rd')) range = "1000 - 1999";

    return (
        <div className="flex items-center gap-2 justify-end">
            <span className="font-mono text-sm text-slate-300 font-medium font-numeric-tabular">
                {value?.toLocaleString()}
            </span>
            {!isPick && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-[10px] uppercase font-bold tracking-wider ${color}`}>
                                {tier.includes('1st') && <span>💎</span>}
                                {label}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 border-slate-700 text-white text-xs">
                            <p><span className="font-mono text-blue-300 font-bold">{value?.toLocaleString()}</span> pts falls within the <span className="font-bold text-white">{tier}</span> tier.</p>
                            <p className="text-slate-400 mt-1">Range: {range}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
};

export default ValueBadge;
