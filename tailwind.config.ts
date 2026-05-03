import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        forge: {
          void: "#05050A",
          obsidian: "#0A0A14",
          charcoal: "#12121C",
          graphite: "#1A1A28",
          steel: "#242436",
          mist: "#3A3A52",
          violet: {
            50: "#F3F0FF",
            100: "#E5DEFF",
            200: "#C9BBFF",
            300: "#A78BFF",
            400: "#8A5CFF",
            500: "#6D28FF",
            600: "#5B17E0",
            700: "#4A10B8",
            800: "#2E0A75",
            900: "#1A0644",
          },
          electric: "#A78BFA",
          plasma: "#B537F2",
          cyan: "#22D3EE",
          lime: "#A3E635",
          ember: "#F97316",
          bone: "#E8E8F0",
          ash: "#8A8AA0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      boxShadow: {
        "glow-violet":
          "0 0 24px rgba(138,92,255,0.45), 0 0 64px rgba(138,92,255,0.18)",
        "glow-plasma":
          "0 0 24px rgba(181,55,242,0.45), 0 0 64px rgba(181,55,242,0.18)",
        "glow-cyan":
          "0 0 24px rgba(34,211,238,0.4), 0 0 64px rgba(34,211,238,0.15)",
        "inner-glass":
          "inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 -1px 0 0 rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "grid-violet":
          "linear-gradient(rgba(138,92,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(138,92,255,0.08) 1px, transparent 1px)",
        "radial-forge":
          "radial-gradient(1200px 600px at 20% -10%, rgba(138,92,255,0.22), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(34,211,238,0.14), transparent 60%), radial-gradient(600px 400px at 50% 110%, rgba(181,55,242,0.18), transparent 60%)",
        "gradient-forge":
          "linear-gradient(135deg, #6D28FF 0%, #B537F2 50%, #22D3EE 100%)",
      },
      backgroundSize: {
        "grid-40": "40px 40px",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
        "spin-slow": "spin 12s linear infinite",
        shimmer: "shimmer 3s linear infinite",
        float: "float 6s ease-in-out infinite",
        scan: "scan 2.5s ease-in-out infinite",
        "fade-up": "fadeUp 0.6s ease-out both",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "0.9" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
