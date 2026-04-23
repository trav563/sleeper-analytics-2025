/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---------- Existing shadcn HSL color tokens ----------
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ---------- Broadcast Scoreboard tokens ----------
        bg:        "var(--bg)",
        "bg-1":    "var(--bg-1)",
        "bg-2":    "var(--bg-2)",
        "bg-3":    "var(--bg-3)",
        text:      "var(--text)",
        "text-dim":  "var(--text-dim)",
        "text-mute": "var(--text-mute)",
        line:        "var(--line)",
        "line-strong": "var(--line-strong)",
        // Renamed from "accent" / "accent-2" to avoid shadcn collision
        signal:    "var(--signal)",
        "signal-2":"var(--signal-2)",
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
        // Only add sizes that don't collide with Tailwind defaults.
        // Broadcast-specific overrides (text-base 13px, text-4xl 44px etc.) would
        // shrink text on every existing un-reskinned page. Re-skin commits use
        // arbitrary values (e.g. text-[13px], text-[44px]) for hero numbers.
        "2xs": "var(--text-2xs)", // 10px — caps eyebrows / column headers
        md:    "var(--text-md)",  // 14px — card titles
      },
      letterSpacing: {
        tight:  "var(--tracking-tight)",
        snug:   "var(--tracking-snug)",
        wide:   "var(--tracking-wide)",
        wider:  "var(--tracking-wider)",
      },
      borderRadius: {
        // shadcn radii (preserved)
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // broadcast radii additions
        xl:   "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop:  "var(--shadow-pop)",
        "glow-signal": "var(--glow-signal)",
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
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
    },
  },
  plugins: [],
}
