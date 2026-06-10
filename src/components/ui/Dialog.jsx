import * as React from "react"
import { cn } from "../../lib/utils" // Assuming utils/cn exists based on commonly used patterns or I'll create it locally if needed. 
// Wait, Card.jsx uses `className` prop but let's see how it merges. 
// If Card.jsx doesn't use `cn`, I'll check `src/utils` again.

// Dialog Implementation
const Dialog = ({ open, onOpenChange, children }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="fixed inset-0" onClick={() => onOpenChange(false)} />
            {children}
        </div>
    );
};

const DialogContent = ({ className, children }) => (
    <div className={`relative z-50 w-full overflow-hidden rounded-lg shadow-lg ${className}`}>
        {children}
    </div>
);

const DialogHeader = ({ className, children }) => (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>
        {children}
    </div>
);

const DialogTitle = ({ className, children }) => (
    <h3 className={`font-semibold leading-none tracking-tight ${className}`}>
        {children}
    </h3>
);

const DialogDescription = ({ className, children }) => (
    <div className={`text-sm text-muted-foreground ${className}`}>
        {children}
    </div>
);

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
