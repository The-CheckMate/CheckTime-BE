// 알림 대기 상태 표시 (타이머)
'use client';

import { useEffect, useState } from 'react';
import { AlarmData } from './AlarmModal';

interface AlarmCountdownProps {
  alarm: AlarmData;
  onComplete?: () => void;
}

export default function AlarmCountdown({
  alarm,
  onComplete,
}: AlarmCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // 남은 시간을 HH:MM:SS로 포맷팅
  const formatTime = (totalSeconds: number) => {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
      2,
      '0',
    );
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours} : ${minutes} : ${seconds}`;
  };

  useEffect(() => {
    const now = new Date();
    const target = new Date();

    target.setHours(parseInt(alarm.time.hour));
    target.setMinutes(parseInt(alarm.time.minute));
    target.setSeconds(parseInt(alarm.time.second));
    target.setMilliseconds(0);

    let seconds = Math.floor((target.getTime() - now.getTime()) / 1000);
    if (seconds < 0) seconds = 0;
    setRemainingSeconds(seconds);

    const interval = setInterval(() => {
      seconds -= 1;
      setRemainingSeconds(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        setRemainingSeconds(0);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [alarm, onComplete]);

  return (
    <div className="my-8 text-center">
      <div className="max-w-lg rounded-2xl p-6 mx-auto">
        {/* 카운트다운 타이머 */}
        <div className="text-4xl font-bold tracking-widest">
          {remainingSeconds !== null
            ? remainingSeconds > 0
              ? formatTime(remainingSeconds)
              : '⏰ 알림 시간입니다!'
            : '대기 중...'}
        </div>
      </div>
    </div>
  );
}
