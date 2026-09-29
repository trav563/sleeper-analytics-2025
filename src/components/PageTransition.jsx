import { motion, useReducedMotion } from 'framer-motion';

const MotionDiv = motion.div;

const PageTransition = ({ children, className }) => {
    const reduceMotion = useReducedMotion();
    return (
        <MotionDiv
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.3, ease: 'easeOut' }}
            className={className}
        >
            {children}
        </MotionDiv>
    );
};

export default PageTransition;
