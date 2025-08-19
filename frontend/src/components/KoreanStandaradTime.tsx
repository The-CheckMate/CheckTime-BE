'use client';

import { useEffect, useState } from 'react';

export default function KoreanStandardTime({
  showMilliseconds = true,
}: {
  showMilliseconds?: boolean;
}) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    let offset = 0;

    const fetchTime = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/time/current'); // 배포 시 서버 주소로 변경
        const data = await res.json();

        if (data.success && data.data.timestamp) {
          const serverTimestamp = data.data.timestamp;
          offset = serverTimestamp - Date.now();
          setTime(new Date(Date.now() + offset));
        }
      } catch (error) {
        console.error('시간 정보를 불러오는 데 실패했습니다', error);
      }
    };

    fetchTime();

    const interval = setInterval(() => {
      setTime(new Date(Date.now() + offset));
    }, 33); // 30FPS 정도로 실시간 업데이트

    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 mb-8">
        <div className="text-center text-gray-400 text-xl">
          시간을 불러오는 중...
        </div>
      </div>
    );
  }

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const millis = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 mb-8">
      <div className="text-center mb-4">
        <div className="text-gray-600 mb-2">
          <span className="font-semibold text-blue-600">한국 표준시</span>
          <span className="text-sm ml-2">(KST)</span>
        </div>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-4 text-6xl font-bold text-gray-800">
          {(() => {
            const [h, m, s, ms] = formatTime(time).split(/[:.]/);
            return (
              <>
                <span>{h}</span>
                <span className="text-gray-400">:</span>
                <span>{m}</span>
                <span className="text-gray-400">:</span>
                <span>{s}</span>
                {showMilliseconds && (
                  <>
                    <span className="text-gray-400">:</span>
                    <span className="text-4xl">{ms}</span>
                  </>
                )}
                <span className="flex items-center text-2xl text-gray-500 ml-2 gap-2">
                  밀리초
                  <input
                    type="checkbox"
                    checked={showMilliseconds}
                    onChange={(e) =>
                      typeof window !== 'undefined' &&
                      document.dispatchEvent(
                        new CustomEvent('toggleMilliseconds', {
                          detail: e.target.checked,
                        }),
                      )
                    }
                    className="w-4 h-4"
                  />
                </span>
              </>
            );
          })()}
        </div>
      </div>

      <div className="text-center mt-4">
        <div className="text-gray-500 text-sm">
          {time.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </div>
      </div>
    </div>
  );
}
