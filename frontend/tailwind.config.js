/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B1220',
          900: '#0F172A',
          800: '#16213E',
          700: '#1E2A4A',
        },
        accent: {
          DEFAULT: '#2563EB',
          dim: '#1D4ED8',
          glow: '#3B82F6',
        },
        present: '#16A34A',
        absent: '#DC2626',
        warn: '#D97706',
        surface: '#F8FAFC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.06), 0 1px 3px 0 rgba(15, 23, 42, 0.08)',
        elevated: '0 4px 12px -2px rgba(15, 23, 42, 0.12)',
      },
      animation: {
        'ring-fill': 'ring-fill 0.6s ease-out forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'ring-fill': {
          '0%': { strokeDashoffset: '283' },
          '100%': { strokeDashoffset: 'var(--ring-offset)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
      },
    },
  },
  plugins: [],
}
