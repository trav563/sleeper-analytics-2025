import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

/**
 * Dark-first theme. The inline script in index.html resolves the persisted
 * preference onto <html data-theme> before first paint (no flash); this
 * provider initializes from that resolved attribute so context and DOM agree,
 * then keeps localStorage + the attribute in sync on toggle.
 */
export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() =>
        document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    );

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
    }, [theme]);

    const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
