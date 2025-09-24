/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',               // we’ll force the 'dark' class below
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './App.jsx',                   // because your App.jsx is at root
  ],
  theme: { extend: {} },
  plugins: [],
};