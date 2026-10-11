/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: '#F7F4EE',
        surface: '#FFFFFF',
        charcoal: {
          DEFAULT: '#292824',
          nav: '#302F2A',
          hover: '#3D3C35',
          dark: '#1F1E1B',
        },
        terracotta: {
          DEFAULT: '#C66B4E',
          hover: '#A9543B',
          light: '#F5EBE7',
        },
        sand: {
          DEFAULT: '#DED2C0',
          light: '#EFE9DE',
        },
        warm: {
          border: '#E6DED2',
          card: '#FCFAF6',
        },
        muted: {
          DEFAULT: '#77736B',
          light: '#9E9A92',
        },
        sage: {
          DEFAULT: '#687568',
          bg: '#EEF2EE',
        },
        amber: {
          DEFAULT: '#B98535',
          bg: '#FAF4E8',
        },
        crimson: {
          DEFAULT: '#A33F35',
          bg: '#FAEDEB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(41, 40, 36, 0.05), 0 1px 2px 0 rgba(41, 40, 36, 0.03)',
        card: '0 2px 6px 0 rgba(41, 40, 36, 0.06)',
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
}
