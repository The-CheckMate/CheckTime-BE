import FaqSection from '@/components/FaqSection';

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto p-8">
      {/* 1. 페이지 제목 및 설명 */}
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2">도움말</h1>
        <p className="text-lg text-slate-500">
          Check Time 서비스에 대해 궁금한 점을 해결해 보세요.
        </p>
      </header>

      {/* 2. 자주 묻는 질문 (FAQ) 컴포넌트 */}
      <FaqSection />

      {/* 3. 추가 문의 섹션 */}
      <section className="text-center mt-12">
        <h3 className="text-xl font-semibold mb-4">
          원하는 답변을 찾지 못하셨나요?
        </h3>
        <p className="text-slate-600 mb-6 font-medium">
          💬 1:1 문의하기 [clolc410@gmail.com]
        </p>
      </section>
    </div>
  );
}
