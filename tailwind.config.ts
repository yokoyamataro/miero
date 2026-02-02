import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // カレンダーイベント区分で使用する動的な背景色クラスをsafelistに追加
  safelist: [
    // 青系
    "bg-blue-500",
    "bg-blue-300",
    "bg-indigo-500",
    "bg-sky-500",
    // 緑系
    "bg-green-500",
    "bg-green-300",
    "bg-teal-500",
    "bg-emerald-500",
    // 暖色系
    "bg-yellow-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-pink-500",
    // 紫系
    "bg-purple-500",
    "bg-violet-500",
    "bg-fuchsia-500",
    // その他
    "bg-cyan-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-gray-500",
    "bg-gray-400",
    "bg-slate-500",
    "bg-slate-400",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
