import { useEffect, useState } from 'react';
import { readToolSession, writeToolSession } from '../utils/toolSession';
export function useToolState(key, initial) {
    const [value, setValue] = useState(() => readToolSession(key) ?? (typeof initial === 'function' ? initial() : initial));
    useEffect(() => { writeToolSession(key, value); }, [key, value]);
    return [value, setValue];
}
