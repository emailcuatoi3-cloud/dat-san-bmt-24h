/**
 * Cấu hình Tailwind — chỉ cần khi muốn build lại assets/css/app.css
 *   npx tailwindcss@3.4.17 -i assets/css/input.css -o assets/css/app.css --minify
 */
const scale = (name) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, `oklch(var(--${name}-${k}) / <alpha-value>)`]));

module.exports = {
  content: ['./pages/**/*.php', './includes/**/*.php', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        background: scale('background'),
        foreground: scale('foreground'),
        primary: scale('primary'),
        accent: scale('accent'),
        secondary: scale('secondary'),
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        body: ['var(--font-body)'],
        heading: ['var(--font-heading)'],
        display: ['var(--font-heading)'],
        label: ['var(--font-label)'],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: { 'fade-up': 'fade-up 0.6s ease-out both', 'fade-in': 'fade-in 0.4s ease-out both' },
    },
  },
  plugins: [],
};
