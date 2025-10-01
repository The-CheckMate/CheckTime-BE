'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkFormData } from '@/types/bookmark';

interface BookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark?: Bookmark; // 수정 모드일 때 전달
  onSubmit: (data: BookmarkFormData) => Promise<void>;
  isLoading?: boolean;
}


export default function BookmarkModal({
  isOpen,
  onClose,
  bookmark,
  onSubmit,
  isLoading,
}: BookmarkModalProps) {
  const [formData, setFormData] = useState<BookmarkFormData>({
    custom_name: '',
    custom_url: '',
    favicon: '',
  });
  const [errors, setErrors] = useState<Partial<BookmarkFormData>>({});

  useEffect(() => {
    if (bookmark) {
      setFormData({
        custom_name: bookmark.custom_name,
        custom_url: bookmark.custom_url,
        favicon: bookmark.favicon || '',
      });
    } else {
      setFormData({
        custom_name: '',
        custom_url: '',
        favicon: '',
      });
    }
    setErrors({});
  }, [bookmark, isOpen]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const validateForm = (): boolean => {
    const newErrors: Partial<BookmarkFormData> = {};

    if (!formData.custom_name.trim()) {
      newErrors.custom_name = '북마크 이름을 입력해주세요.';
    }

    if (!formData.custom_url.trim()) {
      newErrors.custom_url = 'URL을 입력해주세요.';
    } else if (!isValidUrl(formData.custom_url)) {
      newErrors.custom_url = '올바른 URL 형식이 아닙니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const submitData: any = {
        custom_name: formData.custom_name.trim(),
        custom_url: formData.custom_url.trim(),
        // favicon 필드는 전송하지 않음 (백엔드에서 자동 처리)
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleChange = (field: keyof BookmarkFormData, value: string) => {
    setFormData((prev: BookmarkFormData) => ({ ...prev, [field]: value }));
    // 에러가 있었다면 입력시 제거
    if (errors[field]) {
      setErrors((prev: Partial<BookmarkFormData>) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
    >
      {/* 배경 오버레이 */}
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      {/* 모달 콘텐츠 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-8 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {bookmark ? '북마크 수정' : '북마크 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl p-1"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        {/* 폼 내용 */}
        <form onSubmit={handleSubmit} className="p-8">
          {/* 북마크 이름 */}
          <div className="mb-5">
            <label className="block text-gray-700 text-sm font-medium mb-1.5">
              제목
            </label>
            <input
              type="text"
              value={formData.custom_name}
              onChange={(e) => handleChange('custom_name', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg text-sm outline-none transition-all bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 ${
                errors.custom_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="사이트 이름을 입력하세요"
              disabled={isLoading}
            />
            {errors.custom_name && (
              <p className="mt-1 text-sm text-red-600">{errors.custom_name}</p>
            )}
          </div>

          {/* URL */}
          <div className="mb-5">
            <label className="block text-gray-700 text-sm font-medium mb-1.5">
              URL
            </label>
            <input
              type="url"
              value={formData.custom_url}
              onChange={(e) => handleChange('custom_url', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg text-sm outline-none transition-all bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 ${
                errors.custom_url ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="https://example.com"
              disabled={isLoading}
            />
            {errors.custom_url && (
              <p className="mt-1 text-sm text-red-600">{errors.custom_url}</p>
            )}
          </div>


          {/* 버튼들 */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-3 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 text-sm font-medium text-white bg-black rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '처리중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
