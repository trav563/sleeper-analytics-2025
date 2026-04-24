import type { Config } from "tailwindcss";

/**
 * Tailwind theme.extend mapping the CSS variables in tokens.css.
 * Merge this with your existing tailwind.config.ts — do not overwrite plugins, content, etc.
 *
 * Usage examples:
 *   <div className="bg-bg-1 text-text border border-line rounded-xl" />
 *   <span className="text-accent font-display tracking-tight tnum">138.4</span>
 */
const config: Partial<Config> = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg:        "var(--bg)",
        "bg-1":    "var(--bg-1)",
        "bg-2":    "var(--bg-2)",
        "bg-3":    "var(--bg-3)",
        text:      "var(--text)",
        "text-dim":  "var(--text-dim)",
        "text-mute": "var(--text-mute)",
        line:        "var(--line)",
        "line-strong": "var(--line-strong)",
        accent:    "var(--accent)",
        "accent-2":"var(--accent-2)",
        good:      "var(--good)",
        bad:       "var(--bad)",
        warn:      "var(--warn)",
        live:      "var(--live)",
      },
      fontFamily: {
        sans:    ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono:    ["var(--font-mono)"],
      },
      fontSize: {
        "2xs":  "var(--text-2xs)",
        xs:     "var(--text-xs)",
        sm:     "var(--text-sm)",
        base:   "var(--text-base)",
        md:     "var(--text-md)",
        lg:     "var(--text-lg)",
        xl:     "var(--text-xl)",
        "2xl":  "var(--text-2xl)",
        "3xl":  "var(--text-3xl)",
        "4xl":  "var(--text-4xl)",
        "5xl":  "var(--text-5xl)",
      },
      letterSpacing: {
        tight:  "var(--tracking-tight)",
        snug:   "var(--tracking-snug)",
        wide:   "var(--tracking-wide)",
        wider:  "var(--tracking-wider)",
      },
      borderRadius: {
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop:  "var(--shadow-pop)",
        "glow-accent": "var(--glow-accent)",
        "glow-live":   "var(--glow-live)",
      },
      transitionTimingFunction: {
        out:      "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "400ms",
      },
    },
  },
};

export default config;
