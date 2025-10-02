// 검색 결과 및 알림 화면
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlarmData } from '@/components/search-result/AlarmModal';
import { useSearchParams } from 'next/navigation';
import KoreanStandardTime from '@/components/search-result/KoreanStandardTime';
import ServerSearchForm from '@/components/search-result/ServerSearchForm';
import ServerTimeResult, { ServerTimeData } from '@/components/search-result/ServerTimeResult';
import { SiteAPI } from '@/libs/api/sites';

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

  const handleAlarmDelete = () => {
    setAlarmData(null);
  };

  // URL 형식인지 확인하는 함수
  const isValidUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return str.startsWith('http://') || str.startsWith('https://');
    }
  };

  // Site 인터페이스는 이미 import됨


  const handleSubmit = useCallback(async (input: string) => {
    setIsLoading(true);
    setServerTimeData(null);

    try {
      const startTime = Date.now(); // 클라이언트 요청 시작 시간 기록
      const clientTimeAtRequest = new Date().toISOString(); // 요청 시점의 클라이언트 시간

      let finalUrl = input.trim();

      // 백엔드 API에서 URL/키워드 검색 처리
      if (!isValidUrl(finalUrl)) {
        console.log(`키워드 검색 시작: "${finalUrl}"`);
        const searchResult = await SiteAPI.searchSites(finalUrl, true);
        
        if (searchResult.results && searchResult.results.length > 0) {
          finalUrl = searchResult.results[0].url;
          console.log(`검색 성공: ${input} → ${finalUrl}`);
        } else {
          setServerTimeData({
            url: input,
            clientTime: clientTimeAtRequest,
            error: `"${input}"에 대한 검색 결과가 없습니다.\n\n사용 가능한 키워드 예시:\n- 숭실대, SSU, 수강신청\n- 인터파크, 티켓, 콘서트\n- 무신사, 쇼핑, 패션\n- 예스24, 책, 도서\n- 지마켓, 쇼핑몰`,
          });
          setIsLoading(false);
          return;
        }
      }

      // 1. /api/time/compare 엔드포인트 호출
      const compareResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/api/time/compare`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: finalUrl }),
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
            url: finalUrl,
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
            url: finalUrl,
            clientTime: clientTimeAtRequest,
            error: result.error || '서버 시간 비교 실패',
          });
        }
      } else {
        setServerTimeData({
          url: finalUrl,
          clientTime: clientTimeAtRequest,
          error: `API 통신 오류: ${compareResponse.status} ${compareResponse.statusText}`,
        });
      }
    } catch (error: unknown) {
      console.error('서버 시간 확인 실패:', error);
      setServerTimeData({
        url: input,
        clientTime: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : '네트워크 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인하세요.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  }, [initialUrl, handleSubmit]);

  const handleRefresh = () => {
    if (serverTimeData) {
      handleSubmit(serverTimeData.url);
    }
  };

  return (
    <div className="min-h-screen px-4">
      {/* 서버 시간 검색 폼 */}
      <div className="mt-4 flex justify-center mb-4">
        <ServerSearchForm onSubmit={handleSubmit} />
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
            onAlarmDelete={handleAlarmDelete}
          />
        </div>
      )}

      {/* 한국 표준시 */}
      <KoreanStandardTime showMilliseconds={showMilliseconds} />
    </div>
  );
}
