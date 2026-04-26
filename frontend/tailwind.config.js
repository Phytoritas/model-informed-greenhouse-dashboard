/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Pretendard', '"Noto Sans KR"', 'Inter', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
            },
            colors: {
                phytosync: {
                    ivory: '#FAF7F2',
                    surface: '#FFFFFF',
                    warm: '#FFF1E9',
                    blush: '#FFE7E1',
                    primary: '#B42318',
                    tomato: '#E74D3C',
                    terracotta: '#C94F3D',
                    success: '#15803D',
                    sage: '#A8C5A1',
                    olive: '#596B4A',
                    charcoal: '#1F2933',
                    muted: '#667085',
                    border: '#E7DED6',
                },
                status: {
                    ok: '#15803D',
                    caution: '#B95F0B',
                    warning: '#B42318',
                    offline: '#475569',
                    missing: '#667085',
                },
            },
            boxShadow: {
                panel: '0 8px 20px rgba(31, 41, 51, 0.075)',
                landing: '0 18px 40px rgba(31, 41, 51, 0.10)',
                frame: '0 24px 70px rgba(31, 41, 51, 0.14)',
            },
            borderRadius: {
                panel: '10px',
                card: '10px',
                control: '8px',
            },
            spacing: {
                section: 'clamp(2rem, 4vw, 4rem)',
                panel: 'clamp(1rem, 2vw, 1.5rem)',
            },
        },
    },
    plugins: [],
}
