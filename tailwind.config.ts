import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/ui/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noteworthy', '"Bradley Hand"', '"Segoe Print"', 'cursive'],
        serif: ['"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
