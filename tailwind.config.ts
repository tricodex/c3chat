import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand colors with liquid glass effect
        'brand': {
          primary: 'oklch(0.647 0.234 266.82)',
          'primary-hover': 'oklch(0.697 0.234 266.82)',
          secondary: 'oklch(0.722 0.134 296.85)',
          accent: 'oklch(0.768 0.156 315.12)',
          electric: 'oklch(0.815 0.248 287.39)',
        },
        // Semantic colors
        'success': 'oklch(0.671 0.146 142.56)',
        'warning': 'oklch(0.802 0.152 85.87)',
        'error': 'oklch(0.698 0.181 25.33)',
        'info': 'oklch(0.665 0.156 222.67)',
        // Surface colors
        'surface': {
          'sunken': 'var(--c3-bg-primary)',
          'base': 'var(--c3-surface-primary)',
          'raised': 'var(--c3-surface-secondary)',
          'overlay': 'var(--c3-bg-overlay)',
          'hover': 'var(--c3-surface-hover)',
          'active': 'var(--c3-surface-active)',
        },
        // Text colors
        'muted': 'var(--c3-text-muted)',
        'subtle': 'var(--c3-text-tertiary)',
        'secondary': 'var(--c3-text-secondary)',
        'primary': 'var(--c3-text-primary)',
        // Border colors
        'border': {
          DEFAULT: 'var(--c3-border-primary)',
          'subtle': 'var(--c3-border-subtle)',
          'strong': 'var(--c3-border-secondary)',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, oklch(from var(--c3-surface-primary) l c h / 0.9), oklch(from var(--c3-surface-secondary) l c h / 0.7))',
      },
      animation: {
        'fade-in': 'c3-fade-in 0.3s ease-out',
        'slide-up': 'c3-slide-up 0.3s ease-out',
        'pulse-soft': 'c3-pulse 2s ease-in-out infinite',
        'shimmer': 'c3-shimmer 1.5s ease-in-out infinite',
        'float': 'c3-float 3s ease-in-out infinite',
        'typing': 'c3-typing 1.4s infinite',
        'hologram': 'c3-hologram 3s linear infinite',
        'morph': 'c3-morph 8s ease-in-out infinite',
        'shine': 'c3-shine 3s infinite',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        'full': '9999px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      backdropBlur: {
        'xs': '2px',
        '3xl': '64px',
      },
      boxShadow: {
        'glow': '0 0 20px oklch(from var(--c3-primary) l c h / 0.3)',
        'glow-strong': '0 0 30px oklch(from var(--c3-primary) l c h / 0.5)',
        'inner-glow': 'inset 0 0 20px oklch(from var(--c3-primary) l c h / 0.1)',
      },
    },
  },
  plugins: [],
} satisfies Config
