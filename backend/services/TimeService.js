// 시간 동기화를 위해서...
const ntpClient = require('ntp-client');
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class TimeService {
  constructor() {
    this.ntpServers = [
      'pool.ntp.org',
      'time.google.com',
      'time.cloudflare.com',
      'kr.pool.ntp.org'
    ];
    this.cachedOffset = 0; // 캐시된 시간 오프셋
    this.lastSyncTime = null;
    this.syncAccuracy = 0;
  }

  /**
   * 여러 NTP 서버에서 시간을 가져와 평균값 계산
   */
  async syncWithNTP() {
    const results = [];
    
    for (const server of this.ntpServers) {
      try {
        const result = await this.queryNTPServer(server);
        if (result.success) {
          results.push(result);
          
          // 성공한 동기화 로그 저장
          await this.logNTPSync(server, result.offset, result.accuracy, result.rtt, true);
        }
      } catch (error) {
        console.error(`NTP 서버 ${server} 동기화 실패:`, error.message);
        await this.logNTPSync(server, null, null, null, false, error.message);
      }
    }

    if (results.length === 0) {
      throw new Error('모든 NTP 서버 동기화 실패');
    }

    // 평균 오프셋 계산 (이상값 제거)
    const offsets = results.map(r => r.offset);
    const filteredOffsets = this.removeOutliers(offsets);
    
    this.cachedOffset = filteredOffsets.reduce((sum, offset) => sum + offset, 0) / filteredOffsets.length;
    this.syncAccuracy = Math.max(...results.map(r => r.accuracy));
    this.lastSyncTime = new Date();

    console.log(`NTP 동기화 완료 - 오프셋: ${this.cachedOffset.toFixed(2)}ms, 정확도: ±${this.syncAccuracy.toFixed(2)}ms`);
    
    return {
      offset: this.cachedOffset,
      accuracy: this.syncAccuracy,
      syncTime: this.lastSyncTime,
      serverCount: results.length
    };
  }

  /**
   * 단일 NTP 서버 쿼리
   */
  async queryNTPServer(server) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      ntpClient.getNetworkTime(server, 123, (err, date) => {
        const endTime = Date.now();
        const rtt = endTime - startTime;
        
        if (err) {
          reject(err);
          return;
        }

        const localTime = new Date();
        const ntpTime = new Date(date);
        const offset = ntpTime.getTime() - localTime.getTime();
        
        // 정확도는 RTT의 절반으로 추정
        const accuracy = rtt / 2;
        
        resolve({
          success: true,
          ntpTime,
          localTime,
          offset,
          accuracy,
          rtt,
          server
        });
      });
    });
  }

  /**
   * 이상값 제거 (IQR 방법)
   */
  removeOutliers(data) {
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
   * 현재 정확한 시간 반환
   */
  async getCurrentTime() {
    // 마지막 동기화가 5분 이상 지났으면 재동기화
    if (!this.lastSyncTime || (Date.now() - this.lastSyncTime.getTime()) > 5 * 60 * 1000) {
      try {
        await this.syncWithNTP();
      } catch (error) {
        console.warn('NTP 재동기화 실패, 캐시된 오프셋 사용:', error.message);
      }
    }

    const now = new Date();
    const correctedTime = new Date(now.getTime() + this.cachedOffset);
    
    return {
      serverTime: correctedTime.toISOString(),
      timestamp: correctedTime.getTime(),
      timezone: 'Asia/Seoul',
      offset: this.cachedOffset,
      accuracy: this.syncAccuracy,
      lastSyncTime: this.lastSyncTime,
      source: 'NTP'
    };
  }

  /**
   * 특정 시간대의 현재 시간 반환
   */
  getCurrentTimeInTimezone(timezone = 'Asia/Seoul') {
    const now = new Date(Date.now() + this.cachedOffset);
    
    return {
      serverTime: now.toLocaleString('ko-KR', { timeZone: timezone }),
      isoString: now.toISOString(),
      timestamp: now.getTime(),
      timezone,
      offset: this.cachedOffset
    };
  }

  /**
   * 시간 차이 계산 (마이크로초 단위)
   */
  calculateTimeDifference(targetTime) {
    const target = new Date(targetTime);
    const current = new Date(Date.now() + this.cachedOffset);
    
    return {
      differenceMs: target.getTime() - current.getTime(),
      differenceSec: (target.getTime() - current.getTime()) / 1000,
      isInPast: target.getTime() < current.getTime()
    };
  }

  /**
   * NTP 동기화 로그 저장
   */
  async logNTPSync(server, offset, accuracy, rtt, success, errorMessage = null) {
    try {
      await pool.query(`
        INSERT INTO ntp_sync_logs (ntp_server, offset_ms, accuracy_ms, rtt_ms, success, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [server, offset, accuracy, rtt, success, errorMessage]);
    } catch (error) {
      console.error('NTP 로그 저장 실패:', error);
    }
  }

  /**
   * 동기화 상태 확인
   */
  getSyncStatus() {
    const timeSinceLastSync = this.lastSyncTime ? Date.now() - this.lastSyncTime.getTime() : null;
    
    return {
      isSync: !!this.lastSyncTime,
      lastSyncTime: this.lastSyncTime,
      timeSinceLastSync,
      offset: this.cachedOffset,
      accuracy: this.syncAccuracy,
      status: this.getSyncQualityStatus()
    };
  }

  /**
   * 동기화 품질 상태 반환
   */
  getSyncQualityStatus() {
    if (!this.lastSyncTime) return 'not_synced';
    
    const timeSinceSync = Date.now() - this.lastSyncTime.getTime();
    
    if (timeSinceSync > 10 * 60 * 1000) return 'stale'; // 10분 이상
    if (this.syncAccuracy > 100) return 'poor'; // 100ms 이상 오차
    if (this.syncAccuracy > 50) return 'fair'; // 50ms 이상 오차
    if (this.syncAccuracy > 10) return 'good'; // 10ms 이상 오차
    
    return 'excellent'; // 10ms 미만 오차
  }
}

module.exports = TimeService;