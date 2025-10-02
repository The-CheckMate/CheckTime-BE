'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/ui/Header';
import LoginModal from './auth/LoginModal';
import SignupModal from './auth/SignupModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { usePathname, useRouter } from 'next/navigation';

export default function ClientHeader() {
  const router = useRouter();

  const pathname = usePathname();
  const HIDE_ON: string[] = [];
  const hideHeader = HIDE_ON.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  // 전역 헤더 상태
  const [isAuthed, setIsAuthed] = useState(false);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  // 모달 상태
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 새로고침 시에도 로그인 유지
  useEffect(() => {
    const at = localStorage.getItem('accessToken');
    const name = localStorage.getItem('userName') || undefined;
    if (at) {
      setIsAuthed(true);
      setUserName(name);
    }

    // 탭 간 동기화: 다른 탭에서 로그아웃 시 반영
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        const has = !!localStorage.getItem('accessToken');
        setIsAuthed(has);
        setUserName(localStorage.getItem('userName') || undefined);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 로그인 처리
  async function handleLoginSubmit({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로그인 실패');

      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      if (data?.data?.user?.username) {
        localStorage.setItem('userName', data.data.user.username);
        setUserName(data.data.user.username);
      }
      setIsAuthed(true);
      return true; // 모달 닫힘
    } catch (err) {
      alert(err instanceof Error ? err.message : '로그인 중 오류 발생');
      return false;
    }
  }

  // 회원가입 처리
  async function handleSignupSubmit({
    userName,
    email,
    password,
  }: {
    userName: string;
    email: string;
    password: string;
  }) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userName, email, password }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '회원가입 실패');

      // 가입 완료 알림 -> 로그인 모달 열기
      alert('회원가입이 완료되었습니다. 로그인 해주세요.');
      setSignupOpen(false);
      setLoginOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '회원가입 중 오류 발생');
    }
  }

  // 로그아웃
  function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userName');
    setIsAuthed(false);
    setUserName(undefined);
    setConfirmOpen(false);
    alert('로그아웃 되었습니다.');
    router.push('/');
  }

  return (
    <>
      {/* 헤더 */}
      {!hideHeader &&
        (isAuthed ? (
          <Header
            isAuthed
            userName={userName ?? ''}
            onLogoutClick={() => setConfirmOpen(true)}
          />
        ) : (
          <Header onLoginClick={() => setLoginOpen(true)} />
        ))}

      {/* 로그인 모달 */}
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSignupClick={() => {
          setLoginOpen(false);
          setSignupOpen(true);
        }}
        onSubmit={handleLoginSubmit}
      />

      {/* 회원가입 모달 */}
      <SignupModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        onLoginClick={() => {
          setSignupOpen(false);
          setLoginOpen(true);
        }}
        onSubmit={handleSignupSubmit}
      />

      {/* 로그아웃 확인 모달 */}
      <ConfirmModal
        open={confirmOpen}
        title="로그아웃 확인"
        message="정말 로그아웃하시겠습니까?"
        confirmText="로그아웃"
        cancelText="취소"
        onConfirm={handleLogout}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
