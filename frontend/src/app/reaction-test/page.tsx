'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Phase = 'idle' | 'ready' | 'go' | 'tooSoon' | 'result';

// 단일 모드: 0.5s ~ 5s
const DELAY_RANGE: [number, number] = [500, 5000];

export default function Page() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [records, setRecords] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTsRef = useRef<number | null>(null);

  // 최고 기록 로컬 저장
  useEffect(() => {
    const saved = localStorage.getItem('reaction-best-ms');
    if (saved) setBest(Number(saved));
  }, []);
  useEffect(() => {
    if (best != null) localStorage.setItem('reaction-best-ms', String(best));
  }, [best]);

  // 평균
  const average = useMemo(() => {
    if (records.length === 0) return null;
    const sum = records.reduce((a, b) => a + b, 0);
    return Math.round(sum / records.length);
  }, [records]);

  const resetWaitingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = () => {
    if (phase === 'ready' || phase === 'go') return;
    setCurrent(null);
    setPhase('ready');

    const [min, max] = DELAY_RANGE;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;

    resetWaitingTimer();
    timerRef.current = setTimeout(() => {
      setPhase('go');
      startTsRef.current = performance.now();
    }, delay);
  };

  const handleCircleClick = () => {
    if (phase === 'ready') {
      // 너무 빨리 클릭
      resetWaitingTimer();
      setPhase('tooSoon');
      startTsRef.current = null;
      return;
    }
    if (phase === 'go' && startTsRef.current != null) {
      const rt = Math.round(performance.now() - startTsRef.current);
      setCurrent(rt);
      setRecords((prev) => [...prev, rt]);
      setBest((prev) => (prev == null ? rt : Math.min(prev, rt)));
      setPhase('result');
      startTsRef.current = null;
    }
  };

  const handleReset = () => {
    resetWaitingTimer();
    setPhase('idle');
    setCurrent(null);
    setRecords([]);
  };

  const circleColor =
    phase === 'go'
      ? 'bg-red-500'
      : phase === 'tooSoon'
      ? 'bg-red-100'
      : 'bg-gray-100';

  const statusText =
    phase === 'idle'
      ? '게임 시작을 기다리는 중...'
      : phase === 'ready'
      ? '빨간색으로 바뀌면 바로 클릭하세요!'
      : phase === 'go'
      ? '지금! 클릭!'
      : phase === 'tooSoon'
      ? '너무 빨랐어요! (다시 시작)'
      : current != null
      ? `${current} ms`
      : '결과 없음';

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">반응속도 테스트</h1>
          <p className="text-sm text-gray-600">
            티켓팅 성공을 위한 반응속도 측정을 시작하세요!
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 좌측: 메인 카드 */}
          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              {/* 원형 영역 */}
              <div className="flex flex-col items-center">
                <button
                  onClick={handleCircleClick}
                  className={[
                    'flex h-64 w-64 items-center justify-center rounded-full border text-gray-700',
                    circleColor,
                    phase === 'go'
                      ? 'border-green-300'
                      : phase === 'tooSoon'
                      ? 'border-red-300'
                      : 'border-gray-200',
                    'select-none',
                  ].join(' ')}
                >
                  <span className="text-center text-gray-700">
                    {statusText}
                  </span>
                </button>

                {/* 안내 텍스트 */}
                <p className="mt-6 text-center text-sm text-gray-600">
                  아래 버튼을 눌러 게임을 시작하세요
                </p>

                {/* 버튼들 */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleStart}
                    disabled={phase === 'ready' || phase === 'go'}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    게임 시작
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    기록 초기화
                  </button>
                </div>
              </div>
            </div>

            {/* 팁 카드 */}
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <span>🎯 반응속도 향상 팁</span>
              </h3>
              <ul className="space-y-1 text-sm text-amber-900">
                <li>
                  🟡 화면을 집중해서 보고, 빨간색으로 바뀌는 순간 즉시 클릭!
                </li>
                <li>
                  🟡 마우스나 터치패드를 편안하게 잡고 준비 자세를 취하세요.
                </li>
                <li>
                  🟡 너무 일찍 클릭하지 마세요. 성급한 클릭은 실패로 처리됩니다.
                </li>
                <li>🟡 꾸준한 연습이 평균 반응속도 향상의 핵심입니다.</li>
              </ul>
            </div>
          </section>

          {/* 우측: 통계 카드 */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <span>📍 현재 기록</span>
              </h3>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                <p className="text-3xl font-bold tracking-tight">
                  {current != null ? `${current}` : '— — —'}
                </p>
                <p className="text-xs text-gray-500">밀리초 (ms)</p>
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                <p className="text-lg font-semibold">
                  {average != null ? `${average} ms` : '— — —'}
                </p>
                <p className="text-xs text-gray-500">평균 반응속도</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <span>🏆 최고 기록</span>
              </h3>
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-indigo-600">
                  ⓘ
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {best != null ? `${best} ms` : '기록 없음'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {best != null
                      ? '세션/로컬 최저 기록'
                      : '게임을 시작해보세요!'}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
