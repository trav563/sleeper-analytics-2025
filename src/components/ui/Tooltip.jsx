import React, { useState } from 'react';

export const TooltipProvider = ({ children }) => <>{children}</>;

export const Tooltip = ({ children }) => {
    const [isVisible, setIsVisible] = useState(false);

    const childrenArray = React.Children.toArray(children);
    const trigger = childrenArray.find(child => child.type === TooltipTrigger);
    const content = childrenArray.find(child => child.type === TooltipContent);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {trigger}
            {isVisible && content}
        </div>
    );
};

export const TooltipTrigger = ({ children }) => <div className="cursor-help">{children}</div>;

export const TooltipContent = ({ children, className = "" }) => (
    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] z-50 rounded p-2 shadow-xl animate-in fade-in zoom-in-95 duration-200 ${className}`}>
        {children}
        {/* Arrow (Optional, style based on background of tooltip) */}
        {/* We assume standard dark tooltip bg-slate-900 */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
    </div>
);
