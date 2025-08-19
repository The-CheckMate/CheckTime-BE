// 검색 결과 및 알림 화면
'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Info } from 'lucide-react';
import AlarmModal, { AlarmData } from '@/components/AlarmModal';
import { useSearchParams } from 'next/navigation';
import KoreanStandardTime from '@/components/KoreanStandaradTime';
import ServerSearchForm from '@/components/ServerSearchForm';
import AlarmCountdown from '@/components/AlarmCountdown';

// RTTResult와 RTTData 인터페이스는 api/network/rtt에서 사용되므로,
// api/time/compare가 직접 이 데이터를 반환하지 않는다면 필요 없을 수 있습니다.
// 하지만 이전 코드에서 사용되었고, 네트워크 정보 표시를 위해 유지합니다.
// interface RTTResult {
//   success: boolean;
//   timestamp: string;
//   rtt?: number;
// }

// interface RTTData {
//   average: number;
//   min: number;
//   max: number;
//   networkCondition: string;
//   packetLossRate: string;
//   results: RTTResult[];
// }

interface ServerTimeData {
  url: string;
  serverTime?: string; // 실제 타겟 서버의 보정된 시간
  clientTime: string; // 클라이언트 요청 시작 시간
  timeDifference?: number; // 우리 서버 시간 - 타겟 서버 시간 (보정 후)
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

function TimeDisplay({
  time,
  label,
  showMilliseconds = true,
}: {
  time: string;
  label: string;
  showMilliseconds?: boolean;
}) {
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
        {/* Milliseconds text is conditionally rendered based on showMilliseconds prop */}
        {showMilliseconds && (
          <>
            <span className="text-gray-400">:</span>
            <span className="text-4xl">{milliseconds}</span>
          </>
        )}
        {/* The checkbox is always rendered */}
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

function ServerTimeResult({
  data,
  onRefresh,
  showMilliseconds,
  alarmData,
  onAlarmConfirm,
}: {
  data: ServerTimeData;
  onRefresh: () => void;
  showMilliseconds: boolean;
  alarmData?: AlarmData | null; // 알림 데이터가 있을 경우에만 AlarmCountdown 사용(선택적 props)
  onAlarmConfirm: (data: AlarmData) => void; // 알림 설정 완료 핸들러
}) {
  const [currentServerTime, setCurrentServerTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 모달 배경 클릭 시 닫기
  const handleClose = () => {
    setShowModal(false);
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
    const direction = diff > 0 ? '' : '';

    if (absDiff < 1000) {
      return `${direction}${diff.toFixed(2)}ms`;
    } else {
      return `${direction}${(diff / 1000).toFixed(2)}초 (±${(
        absDiff / 1000
      ).toFixed(2)}초)`;
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
      {/* timeComparison.timeDifference를 사용하여 시간 차이 표시 */}
      {data.timeComparison &&
        data.timeComparison.timeDifference !== undefined &&
        data.timeComparison.timeDifference !== null && (
          <div className="mb-8">
            <div className="max-w-md mx-auto bg-green-50 border-2 border-green-200 rounded-xl p-6">
              <div className="text-center">
                <div className="text-green-800 font-medium mb-2">
                  {serverName} 서버가{' '}
                  <span className="font-bold">
                    {getTimeDifferenceText(
                      Math.abs(data.timeComparison.timeDifference),
                    )}
                  </span>{' '}
                  더{' '}
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

      {/* 알람 카운트다운 컴포넌트 */}
      {alarmData && <AlarmCountdown alarm={alarmData} />}

      {/* 새로고침 버튼 */}
      <div className="text-center mb-8">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          새로고침
        </button>
      </div>

      {/* 소요시간 정보 (옵셔널) */}
      {/* data.interval 대신 networkInfo.rtt를 활용할 수 있습니다 */}
      {data.networkInfo && (
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-gray-600">
            <Clock className="w-5 h-5" />
            <span>RTT: {data.networkInfo.rtt.toFixed(1)}ms</span>
            {data.networkInfo.networkDelay && (
              <span className="ml-4">
                네트워크 지연: {data.networkInfo.networkDelay.toFixed(1)}ms
              </span>
            )}
          </div>
        </div>
      )}

      {/* 상세 정보 버튼 */}
      <div className="text-center">
        <button
          className="inline-flex items-center gap-2 px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-lg font-medium"
          onClick={() => setShowModal(true)}
        >
          <Info className="w-5 h-5" />
          정확한 타이밍에 클릭을 도와드릴까요?
        </button>

        {/* 모달은 별도로 렌더링 (button 밖에서) */}
        {showModal && (
          <AlarmModal onConfirm={onAlarmConfirm} onClose={handleClose} />
        )}
      </div>

      {/* 네트워크 정보 (작게 표시) - 이제 networkInfo 사용 */}
      {data.networkInfo && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-center gap-8 text-sm text-gray-500">
            <div>신뢰도: {data.networkInfo.reliability}</div>
            {data.analysis && <div>정확도: {data.analysis.accuracy}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckTimeApp() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverTimeData, setServerTimeData] = useState<ServerTimeData | null>(
    null,
  );
  const [showMilliseconds, setShowMilliseconds] = useState(true);
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get('url');

  const [alarmData, setAlarmData] = useState<AlarmData | null>(null);

  const handleAlarmConfirm = (data: AlarmData) => {
    setAlarmData(data);
  };

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setServerTimeData(null);

    try {
      const startTime = Date.now(); // 클라이언트 요청 시작 시간 기록
      const clientTimeAtRequest = new Date().toISOString(); // 요청 시점의 클라이언트 시간

      // 1. /api/time/compare 엔드포인트 호출
      const compareResponse = await fetch(
        'http://localhost:3001/api/time/compare',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: url }),
        },
      );

      const endTime = Date.now(); // 클라이언트 요청 종료 시간 기록
      const totalProcessingTime = endTime - startTime;

      if (compareResponse.ok) {
        const result = await compareResponse.json();
        if (result.success && result.data) {
          const apiData = result.data;

          // api/time/compare 응답에서 필요한 데이터 추출
          setServerTimeData({
            url,
            clientTime: clientTimeAtRequest, // 클라이언트 요청 시작 시의 시간
            serverTime: apiData.timeComparison?.correctedTargetTime, // 보정된 타겟 서버 시간
            timeDifference: apiData.timeComparison?.timeDifference, // 우리 서버 시간 - 타겟 서버 시간 (백엔드에서 계산된 값)
            rtt: apiData.networkInfo?.rtt,
            networkDelay: apiData.networkInfo?.networkDelay,
            interval: totalProcessingTime, // 클라이언트에서 측정한 총 소요 시간
            timeComparison: apiData.timeComparison,
            networkInfo: apiData.networkInfo,
            analysis: apiData.analysis,
            metadata: apiData.metadata,
            // rttData는 api/network/rtt에서 오는 것이므로, 여기서는 직접 사용하지 않습니다.
            // 필요하다면, api/time/compare에서 유사한 구조를 반환하도록 백엔드를 수정해야 합니다.
          });
        } else {
          setServerTimeData({
            url,
            clientTime: clientTimeAtRequest,
            error: result.error || '서버 시간 비교 실패',
          });
        }
      } else {
        setServerTimeData({
          url,
          clientTime: clientTimeAtRequest,
          error: `API 통신 오류: ${compareResponse.status} ${compareResponse.statusText}`,
        });
      }
    } catch (error: unknown) {
      console.error('서버 시간 확인 실패:', error);
      setServerTimeData({
        url,
        clientTime: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : '네트워크 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인하세요.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (typeof customEvent.detail === 'boolean') {
        setShowMilliseconds(customEvent.detail);
      }
    };

    // URL이 있을 때만 서버 요청
    if (
      initialUrl &&
      typeof initialUrl === 'string' &&
      initialUrl.trim() !== ''
    ) {
      handleSubmit(initialUrl);
    }
    document.addEventListener('toggleMilliseconds', listener);
    return () => document.removeEventListener('toggleMilliseconds', listener);
  }, [initialUrl]);

  const handleRefresh = () => {
    if (serverTimeData) {
      handleSubmit(serverTimeData.url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-600">Check Time</h1>
      </div>

      {/* 서버 시간 검색 폼 */}
      <div className="mt-4 flex justify-center mb-4">
        <ServerSearchForm onSubmit={(url) => handleSubmit(url)} />
      </div>

      <hr className="my-4 border-t border-gray-300 w-full max-w-4xl mx-auto" />

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>서버 시간을 확인하는 중...</span>
          </div>
        </div>
      )}

      {/* 서버 시간 결과 */}
      {serverTimeData && !isLoading && (
        <div className="mb-8">
          <ServerTimeResult
            data={serverTimeData}
            onRefresh={handleRefresh}
            showMilliseconds={showMilliseconds}
            alarmData={alarmData} // 알람 데이터가 있을 경우에만 AlarmCountdown 사용
            onAlarmConfirm={handleAlarmConfirm}
          />
        </div>
      )}

      {/* 한국 표준시 */}
      <KoreanStandardTime showMilliseconds={showMilliseconds} />
    </div>
  );
}
