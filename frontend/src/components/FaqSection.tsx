// file: components/FaqSection.tsx

import FaqItem from './ui/FaqItem';

// FAQ 데이터는 동일하게 유지합니다.
const faqData = [
  {
    id: 1,
    question: '체크타임의 서버 시간은 정확한가요?',
    answer:
      '네, 체크타임은 주요 티켓팅 사이트의 표준 서버 시간을 실시간으로 동기화하여 오차 없는 정확한 시간을 제공합니다.',
  },
  {
    id: 2,
    question: '지원하는 티켓팅 사이트는 어디인가요?',
    answer:
      '현재 인터파크, YES24, 멜론티켓, 티켓링크 등 국내 주요 티켓팅 사이트를 지원하고 있습니다.',
  },
  {
    id: 3,
    question: '반응속도 게임은 티켓팅에 어떤 도움이 되나요?',
    answer:
      '반응속도 게임을 통해 자신의 클릭 반응속도를 측정하고 개선할 수 있습니다. 기록은 데이터베이스에 저장되어, 알림 기능 개선에 활용됩니다.',
  },
  {
    id: 4,
    question: '알림 기능은 어떠한 원리로 작동하나요?',
    answer:
      '체크타임의 알림 기능은 url 서버 시간에 rtt(왕복 시간)과 사용자 반응속도 기록을 반영하여 최적의 타이밍에 알림을 제공합니다.',
  },
];

export default function FaqSection() {
  return (
    <main className="bg-white rounded-xl shadow-lg">
      <div className="divide-y divide-slate-100">
        {faqData.map((item) => (
          <FaqItem
            key={item.id}
            question={item.question}
            answer={item.answer}
          />
        ))}
      </div>
    </main>
  );
}
