import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        spenza: {
          orange: "#EA580C",
          "orange-bright": "#FF4500",
          "orange-soft": "#FFF4ED",
          charcoal: "#171717",
          "charcoal-2": "#1F1F1F",
          ink: "#0A0A0A",
          slate: "#525252",
          mute: "#A3A3A3",
          border: "#E5E5E5",
          "border-dark": "#262626",
          canvas: "#F7F7F7",
          surface: "#FFFFFF",
          success: "#16A34A",
          "success-soft": "#ECFDF5",
          danger: "#DC2626",
          "danger-soft": "#FEF2F2",
          amber: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(23,23,23,0.10)",
        lift: "0 1px 2px rgba(0,0,0,0.05), 0 14px 32px -14px rgba(23,23,23,0.14)",
        focus: "0 0 0 3px rgba(234, 88, 12, 0.18)",
        "orange-hover": "0 8px 18px -8px rgba(234,88,12,0.55)",
      },
      borderRadius: {
        card: "16px",
        input: "12px",
        btn: "10px",
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.9" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        scan: {
          "0%": { left: "-80px" },
          "100%": { left: "100%" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        scan: "scan 4s linear infinite",
        float: "float 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
