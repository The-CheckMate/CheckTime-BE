'use client';

import { useState } from 'react';

interface AlarmTime {
  hour: string;
  minute: string;
  second: string;
}

export interface AlarmOptions {
  preAlerts: number[]; // [60, 30, 10]
  sound: boolean;
  red: boolean;
}

export interface AlarmData {
  time: AlarmTime;
  options: AlarmOptions;
}

interface AlarmModalProps {
  onConfirm: (data: AlarmData) => void;
  onClose: () => void;
}

export default function AlarmModal({ onConfirm, onClose }: AlarmModalProps) {
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [second, setSecond] = useState('');

  const [options, setOptions] = useState<AlarmOptions>({
    preAlerts: [],
    sound: false,
    red: false,
  });

  const togglePreAlert = (secondsBefore: number) => {
    setOptions((prev) => ({
      ...prev,
      preAlerts: prev.preAlerts.includes(secondsBefore)
        ? prev.preAlerts.filter((s) => s !== secondsBefore)
        : [...prev.preAlerts, secondsBefore],
    }));
  };

  const handleToggle = (key: 'sound' | 'red') => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = () => {
    const now = new Date();
    const targetTime = new Date();

    targetTime.setHours(parseInt(hour));
    targetTime.setMinutes(parseInt(minute));
    targetTime.setSeconds(parseInt(second));
    targetTime.setMilliseconds(0);

    const timeUntilTarget = targetTime.getTime() - now.getTime();

    if (timeUntilTarget < 0) {
      alert('❗ 이미 지난 시간입니다. 다시 설정해 주세요.');
      return;
    }

    if (!hour || !minute || !second) {
      alert('⏰ 시간을 모두 입력해 주세요.');
      return;
    }

    onConfirm({
      time: { hour, minute, second },
      options,
    });

    alert('알림이 설정되었습니다.');

    onClose(); // 설정 후 모달 닫기
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-80 flex justify-center items-center z-50">
      모달 배경 클릭 시 닫기
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-80 flex justify-center items-center z-50"
        onClick={onClose}
      >
        {/*실제 모달 박스*/}
        <div
          className="bg-gray-100 p-8 rounded-lg shadow-xl w-[400px]"
          onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 시 닫힘 방지
        >
          <h2 className="text-2xl font-bold mb-6 text-center">⏰ 알림 설정</h2>

          <div className="mb-4">
            <label className="block mb-2 font-semibold">
              알림 받을 시간 설정
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="w-16 p-2 border rounded"
                placeholder="시"
              />
              <span>:</span>
              <input
                type="text"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="w-16 p-2 border rounded"
                placeholder="분"
              />
              <span>:</span>
              <input
                type="text"
                value={second}
                onChange={(e) => setSecond(e.target.value)}
                className="w-16 p-2 border rounded"
                placeholder="초"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-semibold">사전 알림 설정</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.preAlerts.includes(60)}
                  onChange={() => togglePreAlert(60)}
                />
                1분 전 알림
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.preAlerts.includes(30)}
                  onChange={() => togglePreAlert(30)}
                />
                30초 전 알림
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.preAlerts.includes(10)}
                  onChange={() => togglePreAlert(10)}
                />
                10초 전 알림
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.sound}
                  onChange={() => handleToggle('sound')}
                />
                소리 알림
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.red}
                  onChange={() => handleToggle('red')}
                />
                빨간색
              </label>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded transition"
          >
            알림 설정
          </button>
        </div>
      </div>
    </div>
  );
}
