'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (payload: {
    email: string;
    password: string;
  }) => Promise<boolean> | boolean;
  onSignupClick?: () => void; // 회원가입 열기
};

export default function LoginModal({
  open,
  onClose,
  onSubmit,
  onSignupClick,
}: Props) {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '');
    const password = String(fd.get('password') || '');
    setLoading(true);
    try {
      const ok = await onSubmit?.({ email, password });
      if (ok) onClose(); // 로그인 성공 시 모달 닫기
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
      {/* backdrop (배경 클릭으로 닫기) */}
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-12 shadow-lg border border-gray-200">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          aria-label="모달 닫기"
          className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>

        {/* 로고 섹션 (logo-section) */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg text-white flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-500">
              ⏰
            </div>
            <div className="text-xl font-bold text-black">Check Time</div>
          </div>
          <p className="text-sm text-gray-500">계정에 로그인하세요</p>
        </div>

        {/* 로그인 폼 (login-form) */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-200/50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              비밀번호
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                required
                placeholder="비밀번호를 입력하세요"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 pr-10 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-200/50"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="비밀번호 표시 전환"
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="mt-2 text-right">
              <button
                type="button"
                className="text-sm text-indigo-600 hover:underline"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:bg-gray-300"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
                로그인 중…
              </span>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        {/* 구분선 (divider) */}
        <div className="my-6 flex items-center text-sm text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        {/* 하단 링크 (bottom-link) */}
        <p className="text-center text-sm text-gray-500">
          아직 계정이 없으신가요?
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignupClick?.();
            }}
            className="font-medium text-indigo-600 hover:underline"
          >
            회원가입
          </button>
        </p>
      </div>
    </div>
  );
}
