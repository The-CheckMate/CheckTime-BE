'use client';

import React, { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void; // 취소/닫기
};

export default function ConfirmModal({
  open,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // 열릴 때 포커스 이동
    firstBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* overlay: 클릭 시 닫힘 */}
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
      >
        <h3
          id="confirm-title"
          className="text-base font-semibold text-gray-900"
        >
          {title}
        </h3>
        {message && (
          <p id="confirm-message" className="mt-3 text-sm text-gray-600">
            {message}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={firstBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85"
          >
            {confirmText}
          </button>
        </div>

        {/* 우측 상단 닫기 버튼 */}
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
