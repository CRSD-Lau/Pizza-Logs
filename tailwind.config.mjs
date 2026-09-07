const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "serif"],
        rajdhani: ["var(--font-rajdhani)", "sans-serif"],
        sans: ["var(--font-rajdhani)", "var(--font-inter)", "sans-serif"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.35s ease both",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "gold-glow": "0 0 20px color-mix(in srgb, var(--color-flame) 25%, transparent)",
        card: "0 2px 12px rgba(0,0,0,0.4)",
      },
      borderColor: {
        DEFAULT: "var(--color-line)",
      },
    },
  },
  plugins: [],
};

export default config;
