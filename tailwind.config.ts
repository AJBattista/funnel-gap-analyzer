import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Design system
        "ds-bg": "#0f1117",
        "ds-bg-alt": "#141720",
        "ds-panel": "#1c1f2e",
        "ds-panel-elevated": "#232738",
        "ds-text": "#e8eaf0",
        "ds-text-secondary": "#8a8fa8",
        "ds-blue": "#4a90d9",
        "ds-green": "#3daa8c",
        "ds-amber": "#d4a24e",
        "ds-red": "#d94a4a",
      },
    },
  },
  plugins: [],
};
export default config;
