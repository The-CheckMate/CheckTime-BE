//URL 입력 및 확인 버튼 컴포넌트
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SiteAPI } from '@/libs/api/sites';

interface ServerSearchFormProps {
  onSubmit?: (url: string) => void;
}

export default function ServerSearchForm({ onSubmit }: ServerSearchFormProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      // 백엔드 API에서 URL/키워드 검색 처리
      const searchResult = await SiteAPI.searchSites(url.trim(), true);
      
      if (searchResult.results && searchResult.results.length > 0) {
        const finalUrl = searchResult.results[0].url;
        console.log(`검색 성공: ${url} → ${finalUrl}`);
        
        // 검색된 URL로 이동
        onSubmit?.(finalUrl);
        router.push(`/search-result?url=${encodeURIComponent(finalUrl)}`);
      } else {
        setError(`"${url}"에 대한 검색 결과가 없습니다.\n\n사용 가능한 키워드 예시:\n- 숭실대, SSU, 수강신청\n- 인터파크, 티켓, 콘서트\n- 무신사, 쇼핑, 패션\n- 예스24, 책, 도서\n- 지마켓, 쇼핑몰`);
      }
    } catch (error) {
      console.error('사이트 검색 실패:', error);
      setError('사이트 검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="mt-2 flex w-full max-w-3xl items-center gap-3 mx-auto"
      >
        <Input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="서버 시간 확인이 필요한 url 주소를 검색해 보세요"
          className="flex-1 bg-white placeholder:text-gray-400 py-4 text-lg h-14 min-w-0"
        />

        <Button
          type="submit"
          disabled={isLoading}
          className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-150"
        >
          {isLoading ? '검색 중...' : '검색'}
        </Button>
      </form>
      
      {/* 에러 메시지 표시 */}
      {error && (
        <div className="mt-4 text-red-500 text-sm text-center max-w-6xl mx-auto">
          {error}
        </div>
      )}
    </div>
  );
}
