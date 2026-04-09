// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        swarm: {
          bg:       '#08090c',
          surface:  '#0d0f14',
          card:     '#0a0c11',
          border:   '#1a1d24',
          border2:  '#2a2d34',
          text:     '#e8e9ec',
          muted:    '#5a6070',
          dim:      '#3a3f4a',
          ghost:    '#2a3040',
        },
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;