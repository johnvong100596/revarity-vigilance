import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vigilance v2 — cream + black + red
        "bg-primary": "#F5F1EB",
        "bg-secondary": "#EBE5DC",
        "bg-tertiary": "#FFFFFF",
        "accent-primary": "#F04E37",
        "accent-soft": "rgba(240, 78, 55, 0.08)",
        "text-primary": "#1A1A1A",
        "text-secondary": "#595959",
        "text-muted": "#8C8C8C",
        positive: "#1F6E5C",
        negative: "#C8553D",
        "hint-pay-attention": "#C8553D",
        "hint-opportunity": "#F04E37",
        "hint-strategic": "#1F6E5C",
        "crypto-accent": "#C97B1A",
        "invest-accent": "#5544B5",
        "decay-warning": "#D97706",

        // shadcn/ui semantic colors (read HSL triplets from globals.css)
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
      },
      fontFamily: {
        // APP surfaces: Inter for everything — Apple/Tesla-adjacent sans.
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-inter)", "system-ui", "sans-serif"],
        // MARKETING surfaces only (/, /privacy, /terms). Never use these in
        // /app/* — see the Typography Split section in THESIS.md.
        fraunces: ["var(--font-fraunces)", "Georgia", "Cambria", "serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        row: "10px",
        card: "12px",
        hero: "14px",
        frame: "24px",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
