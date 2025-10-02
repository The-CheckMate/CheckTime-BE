'use client';

interface FaqItemProps {
  question: string;
  answer: string;
}

export default function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <details className="group p-6">
      <summary className="flex justify-between items-center font-bold text-lg cursor-pointer list-none">
        {question}
        <span className="transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="text-slate-600 mt-4 leading-relaxed">{answer}</div>
    </details>
  );
}
