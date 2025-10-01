'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

type AuthedProps = {
  isAuthed: true;
  userName: string;
  onLoginClick?: never;
  onLogoutClick: () => void; // 로그아웃 함수
};

type GuestProps = {
  isAuthed?: false;
  userName?: never;
  onLoginClick: () => void; // 로그인 모달 열기
  onLogoutClick?: never;
};

type HeaderProps = AuthedProps | GuestProps;

export default function Header(props: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 backdrop-blur transition-colors duration-300',
        scrolled
          ? 'bg-white/95 border-b border-black/10'
          : 'bg-white/80 border-b border-black/5',
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* 로고 */}
        <Link
          href="/"
          className="flex items-center gap-2 text-black font-semibold text-base"
        >
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm bg-gradient-to-br from-indigo-400 to-purple-500">
            ⏰
          </div>
          Check Time
        </Link>

        {/* 네비게이션 */}
        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600 font-medium">
          <Link href="/ranking" className="hover:text-black transition-colors">
            실시간 랭킹
          </Link>
          <Link
            href="/reaction-test"
            className="hover:text-black transition-colors"
          >
            반응속도 게임
          </Link>
          <Link
            href="/bookmarks"
            className="hover:text-black transition-colors"
          >
            북마크
          </Link>
          <Link href="/help" className="hover:text-black transition-colors">
            도움말
          </Link>
        </nav>

        {/* 액션 */}
        <div className="flex items-center gap-3">
          {props.isAuthed ? (
            <>
              {props.userName && (
                <span className="hidden sm:inline text-sm text-gray-600">
                  안녕하세요, <b>{props.userName}</b>님
                </span>
              )}
              <button
                type="button"
                onClick={() => props.onLogoutClick?.()}
                className="px-4 py-2 rounded-md text-sm border border-gray-300 hover:bg-gray-50"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => props.onLoginClick?.()} // 게스트에서만 허용
              className="bg-black text-white hover:bg-black/80 px-4 py-2 rounded-md text-sm transition"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
