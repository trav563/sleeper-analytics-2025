import { AnimatePresence, motion } from 'framer-motion';
import { Target, X } from 'lucide-react';

/**
 * Pinned bottom-right stack of toast cards. Each represents a player you had
 * starred who just got drafted by another team.
 */
export default function SniperToastHost({ alerts, onDismiss }) {
    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {alerts.map((a) => (
                    <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, x: 80 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 80 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                        className="pointer-events-auto bg-bad/30 border border-bad/50 backdrop-blur rounded-xl shadow-lg p-3 pr-10 min-w-[260px] relative"
                    >
                        <button
                            onClick={() => onDismiss(a.id)}
                            className="absolute top-2 right-2 text-bad hover:text-white"
                            aria-label="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-bad" />
                            <span className="text-xs uppercase tracking-wider text-bad font-semibold">
                                Sniped
                            </span>
                        </div>
                        <p className="font-semibold text-sm">
                            {a.name} <span className="text-text-mute font-normal">({a.pos}, {a.team})</span>
                        </p>
                        <p className="text-xs text-bad/80 mt-0.5">
                            Taken at pick #{a.pickNo}
                        </p>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
