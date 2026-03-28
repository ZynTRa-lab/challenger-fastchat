/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          darker: '#1e1f22',
          dark: '#2b2d31',
          medium: '#313338',
          light: '#383a40',
          hover: '#404249',
          active: '#4e505880',
          brand: '#5865f2',
          'brand-hover': '#4752c4',
          green: '#23a559',
          red: '#f23f43',
          yellow: '#fee75c',
          text: '#dbdee1',
          'text-muted': '#949ba4',
          'text-link': '#00a8fc',
          separator: '#3f4147',
        },
      },
      fontFamily: {
        sans: ['gg sans', 'Noto Sans', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
