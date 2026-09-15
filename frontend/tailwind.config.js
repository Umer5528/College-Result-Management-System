/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],

  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      colors: {
        // Primary — bright, clean academic blue
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb", // primary buttons / links
          700: "#1d4ed8", // active states
          800: "#1e40af",
          900: "#1e3a8a",
        },

        // Success — fresh green
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },

        // Warning — soft amber
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },

        // Danger — clean red
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },

        // Analytics / information — pleasant teal
        insight: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
        },

        // Main application surfaces
        surface: {
          DEFAULT: "#f8fafc",
          50: "#ffffff",
          100: "#f8fafc",
          200: "#f1f5f9",
          300: "#e2e8f0",
        },

        // Text — softer than pure black
        ink: {
          DEFAULT: "#334155",
          dark: "#1e293b",
          muted: "#64748b",
          light: "#94a3b8",
        },
      },

      boxShadow: {
        // Very subtle shadows to keep the UI airy
        soft: "0 1px 3px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.04)",

        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.05)",

        glow: "0 0 0 1px rgba(59, 130, 246, 0.08), 0 8px 24px rgba(59, 130, 246, 0.10)",
      },

      backgroundImage: {
        // Light blue gradient instead of dark navy
        "brand-gradient": "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",

        // Very subtle background decoration
        aurora:
          "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.08), transparent 35%), radial-gradient(circle at 80% 80%, rgba(20,184,166,0.06), transparent 35%)",
      },

      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },

  plugins: [],
};
