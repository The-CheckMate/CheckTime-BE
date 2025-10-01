'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

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
  targetTime: string; // ISO string for the target time
}

interface AlarmModalProps {
  onConfirm: (data: AlarmData) => void;
  onClose: () => void;
}

// 시간 옵션 생성
const generateTimeOptions = (max: number, format: (n: number) => string) => {
  return Array.from({ length: max }, (_, i) => ({
    value: format(i),
    label: format(i),
  }));
};

const hours = generateTimeOptions(24, (n) => n.toString().padStart(2, '0'));
const minutes = generateTimeOptions(60, (n) => n.toString().padStart(2, '0'));
const seconds = generateTimeOptions(60, (n) => n.toString().padStart(2, '0'));

// 토글 스위치 컴포넌트
function ToggleSwitch({ 
  checked, 
  onChange, 
  label 
}: { 
  checked: boolean; 
  onChange: () => void; 
  label: React.ReactNode; 
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-slate-900' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// 체크박스 컴포넌트
function Checkbox({ 
  checked, 
  onChange, 
  label 
}: { 
  checked: boolean; 
  onChange: () => void; 
  label: string; 
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-slate-900 bg-gray-100 border-gray-300 rounded focus:outline-none focus:ring-0"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function AlarmModal({ onConfirm, onClose }: AlarmModalProps) {
  const [hour, setHour] = useState('00');
  const [minute, setMinute] = useState('00');
  const [second, setSecond] = useState('00');

  const [options, setOptions] = useState<AlarmOptions>({
    preAlerts: [],
    sound: true,
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

    onConfirm({
      time: { hour, minute, second },
      options,
      targetTime: targetTime.toISOString(),
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">알림 설정</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 시간 설정 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3 ">
            알림 받을 시간
          </label>
          <div className="flex items-center gap-2">
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              {hours.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}시
                </option>
              ))}
            </select>
            <span className="text-gray-400">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              {minutes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}분
                </option>
              ))}
            </select>
            <span className="text-gray-400">:</span>
            <select
              value={second}
              onChange={(e) => setSecond(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              {seconds.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}초
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 사전 알림 설정 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            사전 알림
          </label>
          <div className="space-y-2">
            <Checkbox
              checked={options.preAlerts.includes(60)}
              onChange={() => togglePreAlert(60)}
              label="1분 전 알림"
            />
            <Checkbox
              checked={options.preAlerts.includes(30)}
              onChange={() => togglePreAlert(30)}
              label="30초 전 알림"
            />
            <Checkbox
              checked={options.preAlerts.includes(10)}
              onChange={() => togglePreAlert(10)}
              label="10초 전 알림"
            />
          </div>
        </div>

        {/* 알림 옵션 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            알림 옵션
          </label>
          <div className="space-y-3">
            <ToggleSwitch
              checked={options.sound}
              onChange={() => handleToggle('sound')}
              label={
                <div className="flex items-center gap-2">
                  소리
                </div>
              }
            />
            <ToggleSwitch
              checked={options.red}
              onChange={() => handleToggle('red')}
              label="빨간색 강조"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors duration-150 text-sm font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors duration-150 text-sm font-medium"
          >
            설정 완료
          </button>
        </div>
      </div>
    </div>
  );
}
