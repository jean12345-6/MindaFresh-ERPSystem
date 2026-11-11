// Tailwind build for POS. Run `npm run css` while working (rebuilds on save), or `npm run css:build` once.
// Commit the built public/css/app.css, so POS looks right even with no internet.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./views/**/*.xian", "./helpers/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#C2410C", dark: "#9A3412", light: "#FDBA8C" },
        ink: { DEFAULT: "#2A1A12", soft: "#4A3A30", muted: "#6B4F3F" },
        peach: { DEFAULT: "#FFE2C7", soft: "#FFF1E4" },
        cream: "#FFF7EF",
        line: { DEFAULT: "#F0DFCF", strong: "#E8D3BF" },
        leaf: { DEFAULT: "#3F6212", bg: "#E9F3D9" },
        sky: { DEFAULT: "#1C3F73", bg: "#DCEAF5" },
        danger: { DEFAULT: "#B42318", bg: "#F8DCD5" }
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"]
      }
    }
  }
};
