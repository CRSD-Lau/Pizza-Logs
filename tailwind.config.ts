import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep backgrounds
        "bg-deep":  "#0a0c10",
        "bg-panel": "#10141c",
        "bg-card":  "#161b26",
        "bg-hover": "#1d2333",
        // Gold palette
        gold:        "#c8a84b",
        "gold-light":"#f0d080",
        "gold-dim":  "#7a6530",
        // Text
        "text-primary":   "#e8dfc8",
        "text-secondary": "#9a8f78",
        "text-dim":       "#5a5548",
        // Damage schools
        school: {
          physical: "#c0c8d8",
          holy:     "#f0c040",
          fire:     "#e06030",
          nature:   "#60c060",
          frost:    "#80c8f0",
          shadow:   "#a070d0",
          arcane:   "#d080f0",
        },
        // WoW class colors
        class: {
          paladin:  "#f4a0c0",
          warrior:  "#c89040",
          mage:     "#80c0f0",
          druid:    "#f0a040",
          priest:   "#e8e8e8",
          shaman:   "#0090f8",
          warlock:  "#9482c9",
          hunter:   "#aad372",
          dk:       "#c41e3a",
          rogue:    "#fff468",
          monk:     "#00ff98",
          dh:       "#a330c9",
        },
        // Semantic
        success: "#50a050",
        danger:  "#c84040",
        warning: "#c89040",
      },
      fontFamily: {
        cinzel:   ["var(--font-cinzel)", "serif"],
        rajdhani: ["var(--font-rajdhani)", "sans-serif"],
        sans:     ["var(--font-rajdhani)", "var(--font-inter)", "sans-serif"],
      },
      backgroundImage: {
        "radial-gold": "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(180,140,60,0.08) 0%, transparent 60%)",
        "radial-purple": "radial-gradient(ellipse 50% 80% at -10% 50%, rgba(80,40,120,0.05) 0%, transparent 60%)",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.35s ease both",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        pulseGold: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.5" },
        },
      },
      boxShadow: {
        "gold-glow": "0 0 20px rgba(200,168,75,0.25)",
        "card":      "0 2px 12px rgba(0,0,0,0.4)",
      },
      borderColor: {
        DEFAULT: "rgba(180,140,60,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
