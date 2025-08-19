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

  // 목표 시각을 시:분:초로 포맷팅
  const formatTargetTime = () => {
    const { hour, minute, second } = alarm.time;
    return `${hour.padStart(2, '0')}:${minute.padStart(
      2,
      '0',
    )}:${second.padStart(2, '0')}`;
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
      <div className="border border-blue-500 max-w-lg rounded-2xl p-6 mx-auto">
        {/* 안내 텍스트 */}
        <div className="text-lg font-semibold mb-2 text-gray-800">
          다음 알림까지
        </div>

        {/* 카운트다운 타이머 */}
        <div className="text-4xl font-bold text-orange-500 tracking-widest mb-2">
          {remainingSeconds !== null
            ? remainingSeconds > 0
              ? formatTime(remainingSeconds)
              : '⏰ 알림 시간입니다!'
            : '대기 중...'}
        </div>

        {/* 목표 시각 표시 */}
        <div className="text-sm text-gray-600">
          목표시간: <span className="font-semibold">{formatTargetTime()}</span>{' '}
          | 한국 표준시간
        </div>
      </div>
    </div>
  );
}
