/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace']
      },
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          active: '#4f46e5'
        },
        surface: {
          DEFAULT: '#1a1a2e',
          light: '#242442',
          lighter: '#2e2e54'
        },
        success: '#22c55e',
        error: '#ef4444'
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'pulse-fast': 'pulse 1s ease-in-out infinite'
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
