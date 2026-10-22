import type { Config } from 'tailwindcss'

/**
 * LeadNest design system.
 *
 * Every value below resolves to a CSS custom property declared in
 * `src/styles/tokens.css`. The stylesheet is the single source of truth: a
 * colour, radius, shadow or timing is only ever written once, and both
 * themes are driven from the same declarations.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1360px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--ink))',

        navy: {
          DEFAULT: 'hsl(var(--navy))',
          soft: 'hsl(var(--navy-soft))',
        },

        brand: {
          50: 'hsl(var(--brand-50))',
          100: 'hsl(var(--brand-100))',
          200: 'hsl(var(--brand-200))',
          300: 'hsl(var(--brand-300))',
          400: 'hsl(var(--brand-400))',
          500: 'hsl(var(--brand-500))',
          600: 'hsl(var(--brand-600))',
          700: 'hsl(var(--brand-700))',
          800: 'hsl(var(--brand-800))',
          900: 'hsl(var(--brand-900))',
        },
        /** Tinted brand surface, its hover state, the text on it and its border. */
        'brand-soft': {
          DEFAULT: 'hsl(var(--brand-soft))',
          hover: 'hsl(var(--brand-soft-hover))',
          text: 'hsl(var(--brand-soft-text))',
          border: 'hsl(var(--brand-soft-border))',
        },
        /** Brand colour used for standalone text, such as links. */
        'brand-text': 'hsl(var(--brand-text))',

        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
          sunken: 'hsl(var(--surface-sunken))',
        },
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          secondary: 'hsl(var(--ink-secondary))',
          muted: 'hsl(var(--ink-muted))',
          inverse: 'hsl(var(--ink))',
        },
        accent: {
          teal: 'hsl(var(--accent-teal))',
          'teal-soft': 'hsl(var(--accent-teal-soft))',
          'teal-strong': 'hsl(var(--accent-teal-strong))',
          violet: 'hsl(var(--accent-violet))',
          'violet-soft': 'hsl(var(--accent-violet-soft))',
          'violet-strong': 'hsl(var(--accent-violet-strong))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          soft: 'hsl(var(--success-soft))',
          border: 'hsl(var(--success-border))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          soft: 'hsl(var(--warning-soft))',
          border: 'hsl(var(--warning-border))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          soft: 'hsl(var(--danger-soft))',
          border: 'hsl(var(--danger-border))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          soft: 'hsl(var(--info-soft))',
          border: 'hsl(var(--info-border))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          hover: 'hsl(var(--sidebar-hover))',
          active: 'hsl(var(--sidebar-active))',
          text: 'hsl(var(--sidebar-text))',
          'text-strong': '#FFFFFF',
          border: 'hsl(var(--sidebar-border))',
        },
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.5rem' }],
        md: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.625rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        control: 'var(--radius-control)',
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        dialog: 'var(--radius-dialog)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        popover: 'var(--shadow-popover)',
        focus: 'var(--shadow-focus)',
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        topbar: 'var(--topbar-height)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out-expo)',
        'in-out-soft': 'var(--ease-in-out-soft)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-slow) var(--ease-out-expo)',
        'slide-up': 'slide-up var(--duration-slower) var(--ease-out-expo)',
        'scale-in': 'scale-in var(--duration-base) var(--ease-out-expo)',
      },
    },
  },
  plugins: [],
}

export default config
