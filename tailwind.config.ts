import type { Config } from "tailwindcss";
const config: Config = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { vimbre: { navy: "#102A43", blue: "#2F80ED", green: "#27AE60", orange: "#F2994A", surface: "#F8FAFC", text: "#1F2937" } }, fontFamily: { sans: ["Inter", "Arial", "sans-serif"] } } }, plugins: [] };
export default config;
