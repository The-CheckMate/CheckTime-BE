'use client';

import ServerSearchForm from '@/components/ServerSearchForm';
import KoreanStandardTime from '@/components/KoreanStandaradTime';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const handleSubmit = (url: string) => {
    router.push(`/result?url=${encodeURIComponent(url)}`);
  };

  return (
    <main className="flex min-h-screen flex-col bg-primary items-center justify-center px-4">
      <h1 className="text-5xl font-bold text-brand-blue-500">Check Time</h1>
      <h2 className="mt-4 text-2xl font-semibold text-black">
        지금, 서버 시간은 몇시인가요?
      </h2>

      <div className="mt-8 w-full max-w-2xl">
        {/* 검색 input + 버튼 */}
        <ServerSearchForm onSubmit={handleSubmit} />
      </div>
      <div className="mt-8 max-w-3xl w-full">
        {/* 한국 표준 시간 컴포넌트 */}
        <KoreanStandardTime />
      </div>
    </main>
  );
}
