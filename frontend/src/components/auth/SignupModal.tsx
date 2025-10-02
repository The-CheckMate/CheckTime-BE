'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (payload: {
    userName: string;
    email: string;
    password: string;
  }) => Promise<void> | void;
  onLoginClick?: () => void; // 로그인 모달 열기
};

export default function SignupModal({
  open,
  onClose,
  onSubmit,
  onLoginClick,
}: Props) {
  const [userName, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const passwordStrength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-zA-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthBarClass =
    passwordStrength <= 1
      ? 'bg-red-500 w-1/4'
      : passwordStrength === 2
      ? 'bg-yellow-500 w-1/2'
      : passwordStrength === 3
      ? 'bg-blue-500 w-3/4'
      : 'bg-green-500 w-full';

  const canSubmit =
    userName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    passwordStrength >= 3 &&
    password === confirmPassword &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit?.({
        userName: userName.trim(),
        email,
        password,
      });
      onClose(); // 회원가입 성공 시 모달 닫기
    } catch (err) {
      alert(
        err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center"
    >
      {/* backdrop */}
      <button
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      {/* panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-gray-200 max-h-[90vh] overflow-y-auto">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          aria-label="모달 닫기"
          className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
        {/* 로고 섹션 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg text-white flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-500">
              ⏰
            </div>
            <div className="text-xl font-bold text-black">Check Time</div>
          </div>
          <p className="text-sm text-gray-500">새로운 계정을 만드세요</p>
        </div>
        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              이름
            </label>
            <input
              id="username"
              type="text"
              value={userName}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="홍길동"
              required
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-200/50"
            />
            {userName && userName.trim().length < 2 && (
              <p className="text-xs text-red-500 mt-1">
                이름은 2자 이상 입력해주세요
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-200/50"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              비밀번호
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 pr-10 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-200/50"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            {/* 강도 표시 */}
            <div className="mt-2 h-[3px] w-full rounded bg-gray-200 overflow-hidden">
              <div className={`h-full transition-all ${strengthBarClass}`} />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              8자 이상, 영문/숫자/특수문자 포함 권장
            </p>
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              비밀번호 확인
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                required
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 pr-10 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-200/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPw ? '🙈' : '👁️'}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500 mt-1">
                비밀번호가 일치하지 않습니다
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:bg-gray-300"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
                회원가입 중…
              </span>
            ) : (
              '회원가입'
            )}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          이미 계정이 있으신가요?
          <button
            type="button"
            onClick={() => {
              onClose();
              onLoginClick?.();
            }}
            className="font-medium text-indigo-600 hover:underline"
          >
            로그인
          </button>
        </p>
      </div>
    </div>
  );
}
