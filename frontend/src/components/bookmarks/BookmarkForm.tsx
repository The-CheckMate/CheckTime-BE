'use client';

import { useState, useEffect } from 'react';
import { BookmarkFormData, Bookmark } from '@/types/bookmark';

interface BookmarkFormProps {
  bookmark?: Bookmark; // 수정 모드일 때 전달
  onSubmit: (data: BookmarkFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function BookmarkForm({
  bookmark,
  onSubmit,
  onCancel,
  isLoading,
}: BookmarkFormProps) {
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
    }
  }, [bookmark]);

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
      await onSubmit(formData);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 북마크 이름 */}
      <div>
        <label
          htmlFor="custom_name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          북마크 이름 *
        </label>
        <input
          id="custom_name"
          type="text"
          value={formData.custom_name}
          onChange={(e) => handleChange('custom_name', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.custom_name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="예: 인터파크 티켓"
          disabled={isLoading}
        />
        {errors.custom_name && (
          <p className="mt-1 text-sm text-red-600">{errors.custom_name}</p>
        )}
      </div>

      {/* URL */}
      <div>
        <label
          htmlFor="custom_url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          URL *
        </label>
        <input
          id="custom_url"
          type="url"
          value={formData.custom_url}
          onChange={(e) => handleChange('custom_url', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.custom_url ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="https://example.com"
          disabled={isLoading}
        />
        {errors.custom_url && (
          <p className="mt-1 text-sm text-red-600">{errors.custom_url}</p>
        )}
      </div>

      {/* 파비콘 URL (선택사항) */}
      <div>
        <label
          htmlFor="favicon"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          파비콘 URL (선택사항)
        </label>
        <input
          id="favicon"
          type="url"
          value={formData.favicon}
          onChange={(e) => handleChange('favicon', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://example.com/favicon.ico"
          disabled={isLoading}
        />
      </div>

      {/* 버튼들 */}
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '처리중...' : bookmark ? '수정' : '추가'}
        </button>
      </div>
    </form>
  );
}
