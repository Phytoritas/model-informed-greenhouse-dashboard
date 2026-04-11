/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Noto Sans KR"', 'Inter', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
            },
            colors: {
                status: {
                    ok: '#0f9f6e',
                    caution: '#d97706',
                    warning: '#dc2626',
                    offline: '#475569',
                    missing: '#64748b',
                },
            },
            boxShadow: {
                panel: '0 14px 40px rgba(15, 23, 42, 0.08)',
            },
            borderRadius: {
                panel: '1.5rem',
            },
        },
    },
    plugins: [],
}
