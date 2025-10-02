'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Info, Bell, X } from 'lucide-react';
import AlarmCountdown from './AlarmCountdown';
import AlarmModal, { AlarmData } from './AlarmModal';

interface ServerTimeData {
  url: string;
  serverTime?: string; // 실제 타겟 서버의 보정된 시간
  clientTime: string; // 클라이언트 요청 시작 시간
  timeDifference?: number; // 우리 서버 시간 - 타겟 서버 시간  (보정 후)
  networkDelay?: number; // RTT의 절반
  rtt?: number; // 왕복 지연 시간
  error?: string;
  interval?: number; // 총 처리 시간 또는 다른 인터벌 (현재는 총 처리 시간 사용)
  // api/time/compare의 응답 구조를 반영하기 위한 추가 필드
  timeComparison?: { 
    ourServerTime: string;
    targetServerTime: string;
    correctedTargetTime: string;
    timeDifference: number;
    timeDifferenceFormatted: string;
    direction: string;
  };
  networkInfo?: {
    rtt: number;
    networkDelay: number;
    reliability: string;
  };
  analysis?: {
    accuracy: string;
    recommendation: string;
    trustLevel: number;
  };
  metadata?: {
    measuredAt: string;
    ntpSyncStatus: string;
    ntpAccuracy: string;
  };
}

interface TimeDisplayProps {
  time: string;
  label: string;
  showMilliseconds?: boolean;
}

function TimeDisplay({ time, label, showMilliseconds = true }: TimeDisplayProps) {
  const [hours, minutes, seconds, milliseconds] = time.split(/[:.]/);

  return (
    <div className="text-center">
      <div className="text-sm text-gray-500 mb-2">{label}</div>
      <div className="flex items-center justify-center gap-4 text-6xl font-bold text-gray-800">
        <span>{hours}</span>
        <span className="text-gray-400">:</span>
        <span>{minutes}</span>
        <span className="text-gray-400">:</span>
        <span>{seconds}</span>
        {showMilliseconds && (
          <>
            <span className="text-gray-400">:</span>
            <span className="text-4xl">{milliseconds}</span>
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
      </div>
    </div>
  );
}

interface ServerTimeResultProps {
  data: ServerTimeData;
  onRefresh: () => void;
  showMilliseconds: boolean;
  alarmData?: AlarmData | null;
  onAlarmConfirm: (data: AlarmData) => void;
  onAlarmDelete?: () => void;
}

export default function ServerTimeResult({
  data,
  onRefresh,
  showMilliseconds,
  alarmData,
  onAlarmConfirm,
  onAlarmDelete,
}: ServerTimeResultProps) {
  const [currentServerTime, setCurrentServerTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 알림 모달 닫기
  const handleAlarmClose = () => {
    setShowAlarmModal(false);
  };

  // 상세 정보 모달 닫기
  const handleDetailClose = () => {
    setShowDetailModal(false);
  };

  useEffect(() => {
    setMounted(true);

    // 서버 시간이 있으면 실시간 업데이트 시작
    if (data.serverTime && !data.error) {
      const serverBaseTime = new Date(data.serverTime);
      const clientBaseTime = new Date(data.clientTime);
      const timeDiff = serverBaseTime.getTime() - clientBaseTime.getTime();

      // 초기 시간 설정
      setCurrentServerTime(new Date(Date.now() + timeDiff));

      // 10ms마다 업데이트
      const timer = setInterval(() => {
        setCurrentServerTime(new Date(Date.now() + timeDiff));
      }, 10);

      return () => clearInterval(timer);
    }
  }, [data.serverTime, data.clientTime, data.error]);

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const millis = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
  };

  const getTimeDifferenceText = (diff: number | undefined) => {
    if (diff === null || diff === undefined) {
      return '계산 불가';
    }

    const absDiff = Math.abs(diff);

    if (absDiff < 1000) {
      return `${absDiff.toFixed(2)}밀리초`;
    } else {
      return `${(absDiff / 1000).toFixed(2)}초`;
    }
  };

  // 서버 시간 데이터 유효성 검사
  const hasServerTime =
    data.serverTime && data.serverTime !== 'N/A' && !data.error;
  const serverUrl = new URL(data.url);
  const serverName = serverUrl.hostname;

  if (data.error) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-red-500 text-xl mb-4">❌ 오류 발생</div>
        <p className="text-gray-600 mb-6">{data.error}</p>
        <button
          onClick={onRefresh}
          className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
      {/* 서버 정보 */}
      <div className="text-center mb-8">
        <div className="text-gray-600 mb-2">
          <span className="font-semibold text-blue-600">{serverName}</span>
          <span className="text-sm ml-2">({data.url})</span>
          <span className="ml-2">서버시간</span>
        </div>
      </div>

      {/* 메인 시간 표시 */}
      <div className="mb-8">
        {hasServerTime && mounted && currentServerTime ? (
          <TimeDisplay
            time={formatTime(currentServerTime)}
            label=""
            showMilliseconds={showMilliseconds}
          />
        ) : hasServerTime && data.serverTime ? (
          <TimeDisplay
            time={formatTime(new Date(data.serverTime))}
            label=""
            showMilliseconds={showMilliseconds}
          />
        ) : (
          <div className="text-center">
            <div className="text-6xl font-bold text-gray-400 mb-4">
              시간 정보 없음
            </div>
            <div className="text-gray-500">
              서버에서 시간 정보를 제공하지 않습니다
            </div>
          </div>
        )}
      </div>

      {/* 시간 차이 정보 */}
      {data.timeComparison &&
        data.timeComparison.timeDifference !== undefined &&
        data.timeComparison.timeDifference !== null && (
          <div className="mb-8">
            <div className="max-w-md mx-auto rounded-xl">
              <div className="text-center">
                <div className="font-medium">
                    타겟 서버가&nbsp;
                  <span className="font-bold">
                    {getTimeDifferenceText(data.timeComparison.timeDifference)}&nbsp;
                  </span>
                  더&nbsp;
                  <span className="font-bold">
                    {data.timeComparison.direction === 'ahead'
                      ? '빠릅니다'
                      : '느립니다'}
                  </span>
                  .
                </div>
              </div>
            </div>
          </div>
        )}


      {/* 새로고침 버튼 */}
      <div className="text-center mb-8">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-150 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* 소요시간 정보 */}
      {data.networkInfo && (
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-gray-600">
            <span>RTT: {data.networkInfo.rtt.toFixed(1)}ms</span>
            {data.networkInfo.networkDelay && (
              <span className="ml-4">
                네트워크 지연: {data.networkInfo.networkDelay.toFixed(1)}ms
              </span>
            )}
          </div>
        </div>
      )}

      {/* 알림 설정 버튼 */}
      {!alarmData && (
        <div className="text-center mb-6">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors duration-200 text-sm font-medium"
            onClick={() => setShowAlarmModal(true)}
          >
            <Bell className="w-4 h-4" />
            알림 설정
          </button>

          {/* 알림 모달 */}
          {showAlarmModal && (
            <AlarmModal onConfirm={onAlarmConfirm} onClose={handleAlarmClose} />
          )}
        </div>
      )}

      {/* 상세 정보 버튼 */}
      <div className="text-center">
        <button
          onClick={() => setShowDetailModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors duration-150 text-xs font-medium"
        >
          <Info className="w-3 h-3" />
          상세 정보
        </button>
      </div>

      {/* 알람 카운트다운 컴포넌트 */}
      {alarmData && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800">알림 활성화</div>
                  <div className="text-xs text-gray-500">
                    목표시간: {new Date(alarmData.targetTime).toLocaleTimeString('ko-KR', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    })} | 한국 표준시간
                  </div>
                </div>
              </div>
              <button
                onClick={onAlarmDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 border border-red-500 rounded-md hover:bg-red-600 hover:border-red-600 transition-colors duration-150"
              >
                사용 안 함
              </button>
            </div>
            <AlarmCountdown alarm={alarmData} />
          </div>
        </div>
      )}

      {/* 상세 정보 모달 */}
      {showDetailModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleDetailClose}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">상세 정보</h2>
              <button
                onClick={handleDetailClose}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  기본 정보
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">서버 URL:</span>
                    <span className="font-mono text-sm">{data.url}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">측정 시간:</span>
                    <span className="font-mono text-sm">
                      {data.metadata?.measuredAt || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 시간 비교 정보 */}
              {data.timeComparison && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    시간 비교
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">우리 서버 시간:</span>
                      <span className="font-mono text-sm">
                        {data.timeComparison.ourServerTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">타겟 서버 시간:</span>
                      <span className="font-mono text-sm">
                        {data.timeComparison.targetServerTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">보정된 타겟 시간:</span>
                      <span className="font-mono text-sm">
                        {data.timeComparison.correctedTargetTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">시간 차이:</span>
                      <span className="font-mono text-sm">
                        {data.timeComparison.timeDifferenceFormatted}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">방향:</span>
                      <span className="font-mono text-sm">
                        {data.timeComparison.direction === 'ahead'
                          ? '타겟이 빠름'
                          : '타겟이 느림'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 네트워크 정보 */}
              {data.networkInfo && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    네트워크 정보
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">RTT:</span>
                      <span className="font-mono text-sm">
                        {data.networkInfo.rtt.toFixed(2)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">네트워크 지연:</span>
                      <span className="font-mono text-sm">
                        {data.networkInfo.networkDelay.toFixed(2)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">신뢰성:</span>
                      <span className="font-mono text-sm">
                        {data.networkInfo.reliability}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 분석 정보 */}
              {data.analysis && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    분석 결과
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">정확도:</span>
                      <span className="font-mono text-sm">
                        {data.analysis.accuracy}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">신뢰 수준:</span>
                      <span className="font-mono text-sm">
                        {data.analysis.trustLevel}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">권장사항:</span>
                      <span className="font-mono text-sm">
                        {data.analysis.recommendation}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 메타데이터 */}
              {data.metadata && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    메타데이터
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">NTP 동기화 상태:</span>
                      <span className="font-mono text-sm">
                        {data.metadata.ntpSyncStatus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">NTP 정확도:</span>
                      <span className="font-mono text-sm">
                        {data.metadata.ntpAccuracy}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ServerTimeData };
