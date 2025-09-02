//URL 입력 및 확인 버튼 컴포넌트
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface ServerSearchFormProps {
  onSubmit?: (url: string) => void;
}

export default function ServerSearchForm({ onSubmit }: ServerSearchFormProps) {
  const [url, setUrl] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    onSubmit?.(url.trim());
    router.push(`/result?url=${encodeURIComponent(url.trim())}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex w-full max-w-2xl items-center gap-2"
    >
      <Input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="서버 시간 확인이 필요한 url 주소를 검색해 보세요"
        className="flex-1 bg-white shadow-md placeholder:text-gray-400 py-4 text-lg h-14"
      />

      <Button
        type="submit"
        className="bg-brand-blue hover:bg-brand-blue-500 active:bg-brand-blue-900"
      >
        Check!
      </Button>
    </form>
  );
}
