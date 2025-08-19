import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      height: {
        '62.5': '15.625rem', // 250px (lg:min-h-62.5)
        '75': '18.75rem', // 300px (모바일 고정 높이)
        '80': '20rem', // 320px (태블릿 고정 높이)
        '96': '24rem', // 50vh 대신 사용
      },
      minHeight: {
        '62.5': '15.625rem',
        '75': '18.75rem',
        '80': '20rem',
      },
      maxHeight: {
        '75': '18.75rem',
        '80': '20rem',
      },
      minWidth: {
        '70': '17.5rem', // 280px (min-w-70)
      },
      maxWidth: {
        '96': '24rem', // 400px (max-w-96)
      },
      colors: {
        primary: '#FAF8FF', // 기존 배경색
        danger: 'FF9D9D', // 알림 발생 시 배경색
        'brand-blue': {
          500: '#3888E3', // 기본 버튼, CheckTime 로고
          700: '#2C6FC2	', // hover 상태 버튼
          900: '#20589E', // 버튼 활성화
        },
      },
      paddingBottom: {
        '20': '5rem', // pb-20 (80px)
      },
    },
  },
  plugins: [],
};

export default config;
