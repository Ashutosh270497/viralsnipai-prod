import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./styles/**/*.{ts,tsx}",
    "../../packages/*/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--ui-font-family-sans)", "sans-serif"],
        mono: ["var(--ui-font-family-mono)", "monospace"],
      },
      boxShadow: {
        xs: "var(--ui-shadow-sm)",
        sm: "var(--ui-shadow-sm)",
        md: "var(--ui-shadow-md)",
        lg: "var(--ui-shadow-lg)"
      },
      spacing: {
        "page-gutter": "var(--ui-page-gutter-min)"
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        brand: {
          50: "var(--ui-color-primary-50)",
          100: "var(--ui-color-primary-100)",
          200: "var(--ui-color-primary-200)",
          300: "var(--ui-color-primary-300)",
          400: "var(--ui-color-primary-400)",
          500: "var(--ui-color-primary-500)",
          600: "var(--ui-color-primary-600)",
          700: "var(--ui-color-primary-700)",
          800: "var(--ui-color-primary-800)",
          900: "var(--ui-color-primary-900)"
        },
        brandAccent: {
          100: "var(--ui-color-accent-100)",
          200: "var(--ui-color-accent-200)",
          300: "var(--ui-color-accent-300)",
          400: "var(--ui-color-accent-400)",
          500: "var(--ui-color-accent-500)",
          600: "var(--ui-color-accent-600)"
        },
        success: {
          500: "var(--ui-color-success-500)"
        },
        warning: {
          500: "var(--ui-color-warning-500)"
        },
        error: {
          500: "var(--ui-color-error-500)"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
