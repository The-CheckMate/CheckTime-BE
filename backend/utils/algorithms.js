/**
 * 알고리즘 유틸리티 함수들
 */

/**
 * 크리스티안 알고리즘 - 네트워크 시간 동기화
 */
function christianAlgorithm(requests) {
  const validRequests = requests.filter(req => req.success && req.rtt < 1000); // 1초 이하 RTT만 사용
  
  if (validRequests.length === 0) {
    throw new Error('유효한 시간 동기화 요청이 없습니다');
  }

  const timeOffsets = validRequests.map(req => {
    const networkDelay = req.rtt / 2; // 네트워크 지연 추정
    return req.serverTime - req.clientTime - networkDelay;
  });

  // 이상값 제거
  const filteredOffsets = removeOutliers(timeOffsets);
  
  // 평균 오프셋 계산
  const avgOffset = filteredOffsets.reduce((sum, offset) => sum + offset, 0) / filteredOffsets.length;
  
  // 정확도 계산 (표준편차 기반)
  const variance = filteredOffsets.reduce((sum, offset) => sum + Math.pow(offset - avgOffset, 2), 0) / filteredOffsets.length;
  const accuracy = Math.sqrt(variance);

  return {
    offset: avgOffset,
    accuracy: accuracy,
    sampleCount: filteredOffsets.length,
    confidence: Math.min(filteredOffsets.length / validRequests.length, 1.0)
  };
}

/**
 * 버클리 알고리즘 - 분산 시간 동기화
 */
function berkeleyAlgorithm(timeServers) {
  const validServers = timeServers.filter(server => server.online && server.rtt < 500);
  
  if (validServers.length < 2) {
    throw new Error('버클리 알고리즘을 위한 충분한 서버가 없습니다');
  }

  // 각 서버의 시간 차이 계산
  const times = validServers.map(server => server.time);
  const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  
  // 이상값 제거
  const filteredTimes = times.filter(time => Math.abs(time - averageTime) < 10000); // 10초 이내
  
  if (filteredTimes.length === 0) {
    throw new Error('모든 서버 시간이 이상값입니다');
  }

  const finalAverageTime = filteredTimes.reduce((sum, time) => sum + time, 0) / filteredTimes.length;
  
  // 각 서버에 대한 조정값 계산
  const adjustments = validServers.map(server => ({
    serverId: server.id,
    adjustment: finalAverageTime - server.time,
    confidence: 1.0 - (Math.abs(server.time - finalAverageTime) / 10000)
  }));

  return {
    synchronizedTime: finalAverageTime,
    adjustments: adjustments,
    participantCount: filteredTimes.length
  };
}

/**
 * 이상값 제거 (IQR 방법)
 */
function removeOutliers(data) {
  if (data.length < 4) return data;
  
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return data.filter(value => value >= lowerBound && value <= upperBound);
}

/**
 * 지수 이동 평균 (EMA)
 */
function exponentialMovingAverage(values, alpha = 0.3) {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  
  return ema;
}

/**
 * 동적 임계값 계산
 */
function calculateDynamicThreshold(historicalData, multiplier = 2) {
  if (historicalData.length < 5) {
    return 2000; // 기본값 2초
  }
  
  const values = historicalData.map(d => d.responseTime);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return Math.max(mean + multiplier * stdDev, 1000); // 최소 1초
}

/**
 * 네트워크 지연 예측
 */
function predictNetworkDelay(rttHistory) {
  if (rttHistory.length < 3) {
    return rttHistory.length > 0 ? rttHistory[rttHistory.length - 1] / 2 : 50;
  }
  
  // 최근 데이터에 더 높은 가중치
  const weights = rttHistory.map((_, index) => Math.pow(0.8, rttHistory.length - index - 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  const weightedAverage = rttHistory.reduce((sum, rtt, index) => {
    return sum + (rtt * weights[index]);
  }, 0) / totalWeight;
  
  return weightedAverage / 2; // RTT의 절반이 단방향 지연
}

/**
 * 최적 새로고침 간격 계산
 */
function calculateOptimalRefreshInterval(targetTime, currentTime, networkDelay, successRate = 0.8) {
  const timeDifference = targetTime - currentTime;
  
  if (timeDifference <= 0) {
    return 0; // 이미 지난 시간
  }
  
  // 기본 오프셋 계산
  let baseOffset = networkDelay * 2; // 네트워크 지연의 2배
  
  // 성공률에 따른 조정
  if (successRate < 0.5) {
    baseOffset *= 2; // 성공률이 낮으면 더 일찍 시도
  } else if (successRate < 0.7) {
    baseOffset *= 1.5;
  }
  
  // 최적 새로고침 시점 계산
  const optimalRefreshTime = targetTime - baseOffset;
  
  return {
    optimalRefreshTime: optimalRefreshTime,
    refreshInterval: Math.max(optimalRefreshTime - currentTime, 0),
    confidence: Math.min(successRate + 0.1, 1.0),
    networkDelay: networkDelay,
    baseOffset: baseOffset
  };
}

/**
 * 서버 응답 시간 분석
 */
function analyzeServerResponse(responseTimes) {
  if (responseTimes.length === 0) {
    return { status: 'insufficient_data' };
  }
  
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, time) => sum + time, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  
  // 서버 상태 판단
  let status = 'excellent';
  if (mean > 5000) status = 'poor';
  else if (mean > 2000) status = 'fair';
  else if (mean > 1000) status = 'good';
  
  return {
    status: status,
    mean: mean,
    median: median,
    p95: p95,
    p99: p99,
    sampleCount: responseTimes.length,
    volatility: calculateVolatility(responseTimes)
  };
}

/**
 * 변동성 계산
 */
function calculateVolatility(values) {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return Math.sqrt(variance) / mean; // 변동계수
}

/**
 * 적응형 타임아웃 계산
 */
function calculateAdaptiveTimeout(historicalData, percentile = 0.95) {
  if (historicalData.length < 10) {
    return 30000; // 기본값 30초
  }
  
  const successfulRequests = historicalData.filter(d => d.success);
  if (successfulRequests.length === 0) {
    return 30000;
  }
  
  const responseTimes = successfulRequests.map(d => d.responseTime);
  const sorted = responseTimes.sort((a, b) => a - b);
  const percentileIndex = Math.floor(sorted.length * percentile);
  
  return Math.min(sorted[percentileIndex] * 1.5, 60000); // 최대 1분
}

/**
 * 시간 정확도 검증
 */
function validateTimeAccuracy(serverTime, clientTime, rtt) {
  const maxAcceptableOffset = 300000; // 5분
  const offset = Math.abs(serverTime - clientTime);
  
  if (offset > maxAcceptableOffset) {
    return {
      valid: false,
      reason: 'time_offset_too_large',
      offset: offset,
      recommendation: 'system_clock_sync_required'
    };
  }
  
  if (rtt > 5000) { // 5초 이상
    return {
      valid: false,
      reason: 'network_delay_too_high',
      rtt: rtt,
      recommendation: 'check_network_connection'
    };
  }
  
  return {
    valid: true,
    offset: offset,
    rtt: rtt,
    accuracy: rtt / 2 // 추정 정확도
  };
}

module.exports = {
  christianAlgorithm,
  berkeleyAlgorithm,
  removeOutliers,
  exponentialMovingAverage,
  calculateDynamicThreshold,
  predictNetworkDelay,
  calculateOptimalRefreshInterval,
  analyzeServerResponse,
  calculateVolatility,
  calculateAdaptiveTimeout,
  validateTimeAccuracy
};