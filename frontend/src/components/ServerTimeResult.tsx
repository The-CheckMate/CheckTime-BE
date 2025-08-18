// components/ServerTimeResult.tsx
'use client';

interface ServerTimeData {
  url: string;
  serverTime?: string;
  clientTime: string;
  timeDifference?: number;
  networkDelay?: number;
  rtt?: number;
  error?: string;
  rttData?: {
    average: number;
    min: number;
    max: number;
    networkCondition: string;
    packetLossRate: string;
  };
}

interface ServerTimeResultProps {
  data: ServerTimeData;
}

export default function ServerTimeResult({ data }: ServerTimeResultProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const millis = String(date.getMilliseconds()).padStart(3, '0');

    return `${hours}:${minutes}:${seconds}.${millis}`;
  };

  const getTimeDifferenceText = (diff: number) => {
    const absDiff = Math.abs(diff);
    const direction = diff > 0 ? '서버가 빠름' : '클라이언트가 빠름';

    if (absDiff < 100) {
      return `거의 동일 (${absDiff}ms ${direction})`;
    } else if (absDiff < 1000) {
      return `${absDiff}ms ${direction}`;
    } else {
      return `${(absDiff / 1000).toFixed(2)}초 ${direction}`;
    }
  };

  const getNetworkQuality = (condition: string) => {
    const qualities: Record<
      string,
      { text: string; color: string; bg: string }
    > = {
      excellent: {
        text: '매우 좋음',
        color: 'text-green-600',
        bg: 'bg-green-50',
      },
      good: { text: '좋음', color: 'text-blue-600', bg: 'bg-blue-50' },
      fair: { text: '보통', color: 'text-yellow-600', bg: 'bg-yellow-50' },
      poor: { text: '나쁨', color: 'text-red-600', bg: 'bg-red-50' },
    };

    return qualities[condition] || qualities['fair'];
  };

  // 서버 시간 상태 확인
  const hasServerTime = data.serverTime && data.serverTime !== 'N/A';
  const serverTimeError = !hasServerTime && !data.error;

  if (data.error) {
    return (
      <div className="mt-8 max-w-2xl w-full bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          ❌ 오류 발생
        </h3>
        <p className="text-red-600 mb-4">{data.error}</p>
        <div className="text-sm text-gray-600">
          <p>
            <strong>요청 URL:</strong> {data.url}
          </p>
          <p>
            <strong>요청 시간:</strong> {formatTime(data.clientTime)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-4xl w-full bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        ⏰ 서버 시간 확인 결과
      </h3>

      <div className="mb-4 p-3 bg-gray-50 rounded">
        <p className="text-sm text-gray-600">확인한 URL</p>
        <p className="font-mono text-blue-600 break-all">{data.url}</p>
      </div>

      {/* 서버 시간 오류 알림 */}
      {serverTimeError && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h4 className="font-semibold text-orange-800 mb-2">
            ⚠️ 서버 시간 정보 없음
          </h4>
          <p className="text-orange-700 text-sm mb-2">
            서버에서 시간 정보를 제공하지 않습니다. 다음 사항을 확인해주세요:
          </p>
          <ul className="text-sm text-orange-600 space-y-1 ml-4">
            <li>• 서버가 Date 헤더를 포함하고 있는지 확인</li>
            <li>• CORS 설정으로 Date 헤더 접근이 차단되지 않았는지 확인</li>
            <li>• 서버가 정상적으로 응답하는지 확인</li>
            <li>• 다른 URL로 테스트해보기</li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 시간 정보 */}
        <div className="space-y-4">
          <div
            className={`p-4 rounded-lg ${
              hasServerTime ? 'bg-blue-50' : 'bg-gray-100'
            }`}
          >
            <h4
              className={`font-semibold mb-2 ${
                hasServerTime ? 'text-blue-800' : 'text-gray-600'
              }`}
            >
              🖥️ 서버 시간
            </h4>
            {hasServerTime ? (
              <>
                <div className="font-mono text-2xl text-blue-900">
                  {formatTime(data.serverTime!)}
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  {new Date(data.serverTime!).toLocaleDateString('ko-KR')}
                </p>
              </>
            ) : (
              <>
                <div className="font-mono text-2xl text-gray-500">
                  정보 없음
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  서버에서 시간 정보를 제공하지 않음
                </p>
              </>
            )}
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">
              💻 클라이언트 시간
            </h4>
            <div className="font-mono text-2xl text-green-900">
              {formatTime(data.clientTime)}
            </div>
            <p className="text-sm text-green-600 mt-1">
              {new Date(data.clientTime).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>

        {/* 분석 정보 */}
        <div className="space-y-4">
          {data.timeDifference !== undefined && hasServerTime ? (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">
                ⏱️ 시간 차이
              </h4>
              <div className="text-lg font-mono text-yellow-900">
                {getTimeDifferenceText(data.timeDifference)}
              </div>
              <p className="text-sm text-yellow-600 mt-1">
                정확한 차이: {data.timeDifference}ms
              </p>
            </div>
          ) : (
            <div className="p-4 bg-gray-100 rounded-lg">
              <h4 className="font-semibold text-gray-600 mb-2">⏱️ 시간 차이</h4>
              <div className="text-lg font-mono text-gray-500">계산 불가</div>
              <p className="text-sm text-gray-500 mt-1">
                서버 시간이 필요합니다
              </p>
            </div>
          )}

          {data.networkDelay !== undefined ? (
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">
                🌐 네트워크 지연
              </h4>
              <div className="text-lg font-mono text-purple-900">
                {data.networkDelay.toFixed(1)}ms
              </div>
              {data.rtt && (
                <p className="text-sm text-purple-600 mt-1">
                  왕복 시간: {data.rtt}ms
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-100 rounded-lg">
              <h4 className="font-semibold text-gray-600 mb-2">
                🌐 네트워크 지연
              </h4>
              <div className="text-lg font-mono text-gray-500">측정 불가</div>
              <p className="text-sm text-gray-500 mt-1">
                서버 응답이 필요합니다
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 네트워크 품질 정보 */}
      {data.rttData && (
        <div className="mt-6 p-4 border-t pt-4">
          <h4 className="font-semibold text-gray-800 mb-3">
            📊 네트워크 품질 분석
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className={`p-3 rounded-lg ${
                getNetworkQuality(data.rttData.networkCondition).bg
              }`}
            >
              <p className="text-sm text-gray-600">상태</p>
              <p
                className={`font-semibold ${
                  getNetworkQuality(data.rttData.networkCondition).color
                }`}
              >
                {getNetworkQuality(data.rttData.networkCondition).text}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">평균 RTT</p>
              <p className="font-semibold">
                {data.rttData.average.toFixed(1)}ms
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">최소/최대</p>
              <p className="font-semibold text-sm">
                {data.rttData.min.toFixed(1)} / {data.rttData.max.toFixed(1)}ms
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">패킷 손실</p>
              <p className="font-semibold">{data.rttData.packetLossRate}%</p>
            </div>
          </div>
        </div>
      )}

      {/* 권장사항 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-2">💡 분석 결과</h4>
        <div className="text-sm text-gray-600 space-y-1">
          {serverTimeError && (
            <p>
              ⚠️ 서버 시간을 확인할 수 없습니다. 서버 설정을 확인하거나 다른
              URL을 시도해보세요.
            </p>
          )}
          {data.timeDifference !== undefined &&
            Math.abs(data.timeDifference) > 1000 && (
              <p>
                ⚠️ 서버와 클라이언트 시간 차이가 1초 이상입니다. 정확한 타이밍이
                중요한 작업시 주의하세요.
              </p>
            )}
          {data.networkDelay !== undefined && data.networkDelay > 500 && (
            <p>🐌 네트워크 지연이 높습니다. 안정적인 연결을 권장합니다.</p>
          )}
          {data.rttData?.networkCondition === 'excellent' && (
            <p>
              ✅ 네트워크 상태가 매우 우수합니다. 정확한 타이밍 접속이
              가능합니다.
            </p>
          )}
          {hasServerTime &&
            (!data.timeDifference || Math.abs(data.timeDifference) < 100) && (
              <p>✅ 서버와의 시간 동기화가 매우 정확합니다.</p>
            )}
          {!serverTimeError && !data.error && (
            <p>✅ 서버와 정상적으로 통신하고 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
