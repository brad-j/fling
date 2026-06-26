/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace']
      },
      colors: {
        accent: {
          DEFAULT: '#00ff66',
          hover: '#39ff88',
          active: '#00cc52'
        },
        surface: {
          DEFAULT: '#020802',
          light: '#061406',
          lighter: '#0b250f'
        },
        phosphor: {
          dim: '#4f9f66',
          DEFAULT: '#b6ffc8',
          bright: '#e4ffe9'
        },
        success: '#39ff88',
        error: '#ff5f56'
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
