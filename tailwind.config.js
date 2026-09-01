/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Muri Rasoi brand tokens
        aubergine: {
          950: '#1A0A1C', // near-black base, deep purple-black
          900: '#25102A',
          800: '#341739',
          700: '#4A1F4F',
        },
        magenta: {
          600: '#A31D5C',
          500: '#C42569',
          400: '#E23A80',
        },
        ember: {
          600: '#B5321F',
          500: '#D6432A',
          400: '#EA5A34',
        },
        marigold: {
          500: '#E8932A',
          400: '#F5B23D',
          300: '#FBCB6E',
        },
        cream: '#F6ECDD',
        brick: '#5A2A22',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(232, 147, 42, 0.25)',
        'glow-magenta': '0 0 45px rgba(196, 37, 105, 0.35)',
      },
      backgroundImage: {
        brick: "url('/images/pattern-brick.svg')",
      },
    },
  },
  plugins: [],
}
