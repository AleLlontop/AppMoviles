/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          lavender: '#A799E7',
          light: '#F8F9FE',
          accent: '#826BF0',
          outline: '#7B7486',
          onSurface: '#191C1E'
        }
      }
    },
  },
  plugins: [],
}
