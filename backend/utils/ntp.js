const dgram = require('dgram');

/**
 * NTP 패킷 구조 상수
 */
const NTP_PACKET_SIZE = 48;
const NTP_TIMESTAMP_DELTA = 2208988800; // 1900년 1월 1일부터 1970년 1월 1일까지의 초

/**
 * NTP 서버 목록
 */
const DEFAULT_NTP_SERVERS = [
  'pool.ntp.org',
  'time.google.com',
  'time.cloudflare.com',
  'kr.pool.ntp.org',
  'time.windows.com',
  'time.apple.com',
  'time.nist.gov'
];

/**
 * NTP 클라이언트 클래스
 */
class NTPClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 5000;
    this.retries = options.retries || 3;
    this.servers = options.servers || DEFAULT_NTP_SERVERS;
  }

  /**
   * NTP 서버에서 시간 조회
   */
  async getTime(server, port = 123) {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      const packet = this.createNTPPacket();
      
      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        client.close();
        reject(new Error(`NTP 서버 ${server} 응답 타임아웃`));
      }, this.timeout);

      // 요청 전송 시간 기록
      const requestTime = Date.now();

      client.send(packet, 0, packet.length, port, server, (err) => {
        if (err) {
          clearTimeout(timeoutId);
          client.close();
          reject(err);
          return;
        }
      });

      client.on('message', (msg) => {
        clearTimeout(timeoutId);
        
        try {
          const responseTime = Date.now();
          const result = this.parseNTPResponse(msg, requestTime, responseTime);
          client.close();
          resolve(result);
        } catch (error) {
          client.close();
          reject(error);
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeoutId);
        client.close();
        reject(err);
      });
    });
  }

  /**
   * NTP 패킷 생성
   */
  createNTPPacket() {
    const packet = Buffer.alloc(NTP_PACKET_SIZE);
    
    // LI (2 bits) + VN (3 bits) + Mode (3 bits) = 0x23
    // LI = 0 (no warning), VN = 4 (version), Mode = 3 (client)
    packet[0] = 0x23;
    
    // 나머지 필드는 0으로 초기화 (이미 Buffer.alloc이 0으로 초기화)
    
    return packet;
  }

  /**
   * NTP 응답 파싱
   */
  parseNTPResponse(buffer, requestTime, responseTime) {
    if (buffer.length < NTP_PACKET_SIZE) {
      throw new Error('NTP 응답 패킷이 너무 짧습니다');
    }

    // Stratum 검증 (0은 유효하지 않음)
    const stratum = buffer[1];
    if (stratum === 0) {
      throw new Error('유효하지 않은 NTP 서버 응답');
    }

    // 서버 전송 시간 (Transmit timestamp)
    const transmitTimestamp = this.parseTimestamp(buffer, 40);
    
    // 클라이언트 시간과 서버 시간 비교
    const serverTime = new Date(transmitTimestamp * 1000);
    const clientTime = new Date(responseTime);
    
    // RTT (Round Trip Time) 계산
    const rtt = responseTime - requestTime;
    
    // 네트워크 지연 추정
    const networkDelay = rtt / 2;
    
    // 시간 오프셋 계산
    const offset = serverTime.getTime() - clientTime.getTime() + networkDelay;
    
    return {
      serverTime: serverTime,
      clientTime: clientTime,
      offset: offset,
      rtt: rtt,
      networkDelay: networkDelay,
      stratum: stratum,
      precision: buffer[3],
      success: true
    };
  }

  /**
   * NTP 타임스탬프 파싱
   */
  parseTimestamp(buffer, offset) {
    // 32비트 초 부분
    const seconds = buffer.readUInt32BE(offset);
    
    // 32비트 소수 부분
    const fraction = buffer.readUInt32BE(offset + 4);
    
    // 1900년 기준에서 1970년 기준으로 변환
    const timestamp = seconds - NTP_TIMESTAMP_DELTA + (fraction / 0x100000000);
    
    return timestamp;
  }

  /**
   * 여러 NTP 서버에서 시간 조회 (병렬)
   */
  async getTimeFromMultipleServers(servers = this.servers) {
    const promises = servers.map(server => 
      this.getTimeWithRetry(server).catch(error => ({ server, error }))
    );
    
    const results = await Promise.all(promises);
    
    // 성공한 결과만 필터링
    const successfulResults = results.filter(result => !result.error);
    
    if (successfulResults.length === 0) {
      throw new Error('모든 NTP 서버에서 시간 조회 실패');
    }
    
    return successfulResults;
  }

  /**
   * 재시도 로직이 있는 NTP 시간 조회
   */
  async getTimeWithRetry(server) {
    let lastError;
    
    for (let i = 0; i < this.retries; i++) {
      try {
        const result = await this.getTime(server);
        return { server, ...result };
      } catch (error) {
        lastError = error;
        
        // 마지막 재시도가 아니면 잠시 대기
        if (i < this.retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 최적의 NTP 서버 선택
   */
  async findBestServer(servers = this.servers) {
    try {
      const results = await this.getTimeFromMultipleServers(servers);
      
      // RTT가 가장 낮은 서버 선택
      const bestServer = results.reduce((best, current) => 
        current.rtt < best.rtt ? current : best
      );
      
      return bestServer;
    } catch (error) {
      throw new Error('최적의 NTP 서버를 찾을 수 없습니다');
    }
  }
}

/**
 * SNTP (Simple NTP) 클라이언트
 */
class SNTPClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 3000;
  }

  /**
   * 간단한 SNTP 요청
   */
  async getTime(server, port = 123) {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      const packet = Buffer.alloc(48);
      
      // SNTP 헤더 설정
      packet[0] = 0x1b; // LI=0, VN=3, Mode=3
      
      const startTime = process.hrtime.bigint();
      
      const timeoutId = setTimeout(() => {
        client.close();
        reject(new Error('SNTP 타임아웃'));
      }, this.timeout);

      client.send(packet, 0, packet.length, port, server, (err) => {
        if (err) {
          clearTimeout(timeoutId);
          client.close();
          reject(err);
        }
      });

      client.on('message', (msg) => {
        clearTimeout(timeoutId);
        const endTime = process.hrtime.bigint();
        const rtt = Number(endTime - startTime) / 1000000; // 밀리초로 변환
        
        try {
          const result = this.parseSNTPResponse(msg, rtt);
          client.close();
          resolve(result);
        } catch (error) {
          client.close();
          reject(error);
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeoutId);
        client.close();
        reject(err);
      });
    });
  }

  /**
   * SNTP 응답 파싱
   */
  parseSNTPResponse(buffer, rtt) {
    if (buffer.length < 48) {
      throw new Error('SNTP 응답이 너무 짧습니다');
    }

    // 서버 전송 시간 추출
    const seconds = buffer.readUInt32BE(40) - NTP_TIMESTAMP_DELTA;
    const fraction = buffer.readUInt32BE(44);
    const timestamp = seconds + (fraction / 0x100000000);
    
    const serverTime = new Date(timestamp * 1000);
    const now = new Date();
    const offset = serverTime.getTime() - now.getTime();
    
    return {
      serverTime,
      clientTime: now,
      offset,
      rtt,
      networkDelay: rtt / 2,
      success: true
    };
  }
}

/**
 * 시간 동기화 유틸리티 함수들
 */

/**
 * 시스템 시간과 NTP 시간 비교
 */
async function compareSystemTimeWithNTP(ntpServer = 'pool.ntp.org') {
  const ntpClient = new NTPClient();
  
  try {
    const result = await ntpClient.getTime(ntpServer);
    const systemTime = new Date();
    const timeDifference = Math.abs(result.serverTime.getTime() - systemTime.getTime());
    
    return {
      systemTime,
      ntpTime: result.serverTime,
      difference: timeDifference,
      acceptable: timeDifference < 5000, // 5초 이내면 허용
      rtt: result.rtt
    };
  } catch (error) {
    throw new Error(`시간 비교 실패: ${error.message}`);
  }
}

/**
 * 여러 NTP 서버의 시간 일치성 확인
 */
async function checkNTPConsistency(servers = DEFAULT_NTP_SERVERS.slice(0, 3)) {
  const ntpClient = new NTPClient();
  
  try {
    const results = await ntpClient.getTimeFromMultipleServers(servers);
    
    if (results.length < 2) {
      throw new Error('일치성 확인을 위한 충분한 서버가 없습니다');
    }
    
    // 모든 서버 시간의 평균 계산
    const averageTime = results.reduce((sum, result) => 
      sum + result.serverTime.getTime(), 0) / results.length;
    
    // 각 서버와 평균의 차이 계산
    const deviations = results.map(result => ({
      server: result.server,
      deviation: Math.abs(result.serverTime.getTime() - averageTime),
      time: result.serverTime
    }));
    
    // 최대 편차 확인
    const maxDeviation = Math.max(...deviations.map(d => d.deviation));
    
    return {
      consistent: maxDeviation < 1000, // 1초 이내면 일치
      averageTime: new Date(averageTime),
      maxDeviation,
      serverResults: deviations
    };
  } catch (error) {
    throw new Error(`일치성 확인 실패: ${error.message}`);
  }
}

/**
 * 고정밀 시간 측정
 */
function getHighPrecisionTime() {
  const hrTime = process.hrtime();
  const timestamp = Date.now();
  const nanoseconds = hrTime[0] * 1000000000 + hrTime[1];
  
  return {
    timestamp,
    nanoseconds,
    precision: 'nanosecond'
  };
}

/**
 * 시간 동기화 품질 평가
 */
function evaluateTimeSync(ntpResults) {
  if (!ntpResults || ntpResults.length === 0) {
    return { quality: 'poor', reason: 'no_data' };
  }
  
  const validResults = ntpResults.filter(r => r.success);
  if (validResults.length === 0) {
    return { quality: 'poor', reason: 'no_valid_results' };
  }
  
  const avgRtt = validResults.reduce((sum, r) => sum + r.rtt, 0) / validResults.length;
  const maxRtt = Math.max(...validResults.map(r => r.rtt));
  
  // RTT 기반 품질 평가
  if (avgRtt > 1000) {
    return { quality: 'poor', reason: 'high_latency', avgRtt };
  } else if (avgRtt > 500) {
    return { quality: 'fair', reason: 'moderate_latency', avgRtt };
  } else if (avgRtt > 100) {
    return { quality: 'good', reason: 'low_latency', avgRtt };
  } else {
    return { quality: 'excellent', reason: 'very_low_latency', avgRtt };
  }
}

/**
 * 시간 오프셋 보정
 */
function correctTimeOffset(localTime, offset) {
  return new Date(localTime.getTime() + offset);
}

/**
 * 시간 동기화 통계 계산
 */
function calculateSyncStats(syncHistory) {
  if (!syncHistory || syncHistory.length === 0) {
    return null;
  }
  
  const offsets = syncHistory.map(s => s.offset);
  const rtts = syncHistory.map(s => s.rtt);
  
  const avgOffset = offsets.reduce((sum, offset) => sum + offset, 0) / offsets.length;
  const avgRtt = rtts.reduce((sum, rtt) => sum + rtt, 0) / rtts.length;
  
  // 표준편차 계산
  const offsetVariance = offsets.reduce((sum, offset) => sum + Math.pow(offset - avgOffset, 2), 0) / offsets.length;
  const offsetStdDev = Math.sqrt(offsetVariance);
  
  return {
    avgOffset,
    avgRtt,
    offsetStdDev,
    stability: offsetStdDev < 100 ? 'stable' : offsetStdDev < 500 ? 'moderate' : 'unstable',
    sampleCount: syncHistory.length,
    minOffset: Math.min(...offsets),
    maxOffset: Math.max(...offsets),
    lastSync: syncHistory[syncHistory.length - 1].timestamp
  };
}

/**
 * NTP 서버 상태 확인
 */
async function checkNTPServerStatus(server, timeout = 3000) {
  const client = new NTPClient({ timeout });
  
  try {
    const result = await client.getTime(server);
    return {
      server,
      status: 'online',
      rtt: result.rtt,
      stratum: result.stratum,
      offset: result.offset,
      quality: result.rtt < 100 ? 'excellent' : result.rtt < 500 ? 'good' : 'poor'
    };
  } catch (error) {
    return {
      server,
      status: 'offline',
      error: error.message
    };
  }
}

/**
 * 모든 기본 NTP 서버 상태 확인
 */
async function checkAllNTPServers() {
  const statusPromises = DEFAULT_NTP_SERVERS.map(server => 
    checkNTPServerStatus(server)
  );
  
  const results = await Promise.all(statusPromises);
  
  const onlineServers = results.filter(r => r.status === 'online');
  const offlineServers = results.filter(r => r.status === 'offline');
  
  return {
    total: results.length,
    online: onlineServers.length,
    offline: offlineServers.length,
    servers: results,
    bestServer: onlineServers.length > 0 ? 
      onlineServers.reduce((best, current) => current.rtt < best.rtt ? current : best) : null
  };
}

/**
 * 시간 동기화 권장사항 생성
 */
function generateSyncRecommendations(syncStats) {
  const recommendations = [];
  
  if (!syncStats) {
    recommendations.push('시간 동기화를 시작하세요');
    return recommendations;
  }
  
  if (Math.abs(syncStats.avgOffset) > 5000) {
    recommendations.push('시스템 시간이 크게 벗어났습니다. 시스템 시간을 확인하세요');
  }
  
  if (syncStats.avgRtt > 1000) {
    recommendations.push('네트워크 지연이 높습니다. 더 가까운 NTP 서버를 사용하세요');
  }
  
  if (syncStats.stability === 'unstable') {
    recommendations.push('시간 동기화가 불안정합니다. 네트워크 연결을 확인하세요');
  }
  
  if (syncStats.sampleCount < 5) {
    recommendations.push('더 정확한 동기화를 위해 더 많은 샘플이 필요합니다');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('시간 동기화 상태가 양호합니다');
  }
  
  return recommendations;
}

/**
 * 시간대 변환 유틸리티
 */
function convertTimezone(date, fromTimezone, toTimezone) {
  try {
    const fromDate = new Date(date.toLocaleString('en-US', { timeZone: fromTimezone }));
    const toDate = new Date(date.toLocaleString('en-US', { timeZone: toTimezone }));
    
    return {
      originalTime: date,
      convertedTime: toDate,
      fromTimezone,
      toTimezone,
      offset: toDate.getTime() - fromDate.getTime()
    };
  } catch (error) {
    throw new Error(`시간대 변환 실패: ${error.message}`);
  }
}

/**
 * 시간 동기화 로그 생성
 */
function createSyncLog(syncResult, metadata = {}) {
  return {
    timestamp: new Date(),
    server: syncResult.server,
    success: syncResult.success,
    offset: syncResult.offset,
    rtt: syncResult.rtt,
    stratum: syncResult.stratum,
    networkDelay: syncResult.networkDelay,
    quality: syncResult.rtt < 100 ? 'excellent' : syncResult.rtt < 500 ? 'good' : 'poor',
    metadata: {
      userAgent: metadata.userAgent,
      clientIP: metadata.clientIP,
      version: metadata.version,
      ...metadata
    }
  };
}

module.exports = {
  NTPClient,
  SNTPClient,
  compareSystemTimeWithNTP,
  checkNTPConsistency,
  getHighPrecisionTime,
  evaluateTimeSync,
  correctTimeOffset,
  calculateSyncStats,
  checkNTPServerStatus,
  checkAllNTPServers,
  generateSyncRecommendations,
  convertTimezone,
  createSyncLog,
  DEFAULT_NTP_SERVERS
};