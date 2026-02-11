/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'morandi-blue': '#7B8FA1',   // 莫兰迪蓝 - 低饱和度灰蓝
        'artistic-red': '#B57B7B',   // 艺术感红 - 低饱和度灰红
      },
    },
  },
  plugins: [],
};
