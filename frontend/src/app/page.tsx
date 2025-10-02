'use client';

import ServerSearchForm from '@/components/search-result/ServerSearchForm';
import { useRouter } from 'next/navigation';
import React from 'react';
import KoreanStandardTime from '@/components/search-result/KoreanStandardTime';

export default function Home() {
  const router = useRouter();
  const handleSubmit = (url: string) => {
    router.push(`/search-result?url=${encodeURIComponent(url)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {' '}
      {/* Hero */}
      <section className="text-center py-16">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-600 text-sm font-medium px-3 py-1 rounded-full mb-6">
          ✨ 정확한 서버 시간 확인 서비스
        </div>
        <h1 className="text-6xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-black to-gray-600 text-transparent bg-clip-text mb-6">
          티켓팅 성공을 위한
          <br />
          정확한 시간 동기화
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
          서버와의 시간 차이를 실시간으로 확인하고, 완벽한 타이밍으로 티켓팅에
          성공하세요!
        </p>
      </section>
      {/* URL Input */}
      <section className="max-w-xl mx-auto">
        <ServerSearchForm onSubmit={handleSubmit} />
      </section>
      {/* Current Time */}
      <section className="max-w-3xl mx-auto mb-20 p-10">
        <KoreanStandardTime showToggle={false} />
      </section>
    </div>
  );
}
