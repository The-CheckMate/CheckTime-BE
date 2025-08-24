// 인터벌 계산을 위하여...
const TimeService = require('./TimeService');
const NetworkService = require('./NetworkService');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class IntervalService {
  constructor() {
    this.timeService = new TimeService();
    this.networkService = new NetworkService();
    
    // 기본 설정값
    this.defaultOffset = 2500; // 기본 2.5초 전 새로고침
    this.minOffset = 500; // 최소 0.5초
    this.maxOffset = 10000; // 최대 10초
  }

  /**
   * 동적 인터벌 계산 - 메인 알고리즘
   */
  async calculateOptimalInterval(targetUrl, targetTime, userId = null) {
    try {
      console.log(`최적 인터벌 계산 시작: ${targetUrl} → ${targetTime}`);
      
      // 1. 현재 정확한 시간 확인
      const currentTime = await this.timeService.getCurrentTime();
      
      // 2. 종합 네트워크 분석
      const networkAnalysis = await this.networkService.comprehensiveNetworkAnalysis(targetUrl);
      
      // 3. 사이트 정보 및 과거 데이터 조회
      const siteInfo = await this.getSiteInfo(targetUrl);
      const historicalData = await this.getHistoricalPerformance(siteInfo.id, userId);
      
      // 4. 동적 오프셋 계산
      const dynamicOffset = this.calculateDynamicOffset(
        networkAnalysis,
        siteInfo,
        historicalData
      );
      
      // 5. 최적 새로고침 시간 계산
      const optimalRefreshTime = this.calculateOptimalRefreshTime(
        targetTime,
        dynamicOffset,
        currentTime
      );
      
      // 6. 신뢰도 점수 계산
      const confidenceScore = this.calculateConfidenceScore(
        networkAnalysis,
        historicalData,
        dynamicOffset
      );
      
      // 7. 결과 검증 및 조정
      const finalResult = this.validateAndAdjustResult({
        targetUrl,
        targetTime,
        currentTime,
        optimalRefreshTime,
        dynamicOffset,
        confidenceScore,
        networkAnalysis,
        siteInfo,
        historicalData
      });
      
      console.log(`최적 인터벌 계산 완료: ${dynamicOffset}ms 전 새로고침`);
      
      return finalResult;
      
    } catch (error) {
      console.error('최적 인터벌 계산 실패:', error);
      
      // 폴백: 기본값 반환
      return this.getFallbackResult(targetUrl, targetTime, error.message);
    }
  }

  /**
   * 동적 오프셋 계산 핵심 알고리즘
   */
  calculateDynamicOffset(networkAnalysis, siteInfo, historicalData) {
    let baseOffset = siteInfo.optimal_offset || this.defaultOffset;
    
    // 1. 네트워크 RTT 기반 조정
    const rttAdjustment = this.calculateRTTAdjustment(networkAnalysis.rtt);
    
    // 2. 서버 부하 기반 조정
    const loadAdjustment = this.calculateLoadAdjustment(networkAnalysis.serverLoad);
    
    // 3. 과거 성공률 기반 조정
    const historyAdjustment = this.calculateHistoryAdjustment(historicalData);
    
    // 4. 네트워크 안정성 기반 조정
    const stabilityAdjustment = this.calculateStabilityAdjustment(networkAnalysis.rtt);
    
    // 5. 시간대별 트래픽 기반 조정
    const trafficAdjustment = this.calculateTrafficAdjustment(new Date());
    
    // 총 오프셋 계산
    let totalOffset = baseOffset + rttAdjustment + loadAdjustment + historyAdjustment + stabilityAdjustment + trafficAdjustment;
    
    // 범위 제한
    totalOffset = Math.max(this.minOffset, Math.min(this.maxOffset, totalOffset));
    
    console.log(`오프셋 계산 - 기본: ${baseOffset}ms, RTT: +${rttAdjustment}ms, 부하: +${loadAdjustment}ms, 히스토리: +${historyAdjustment}ms, 최종: ${totalOffset}ms`);
    
    return Math.round(totalOffset);
  }

  /**
   * RTT 기반 조정값 계산
   */
  calculateRTTAdjustment(rttAnalysis) {
    const avgRTT = rttAnalysis.average;
    const jitter = rttAnalysis.jitter;
    
    // 평균 RTT의 50% + 지터의 200%를 추가 오프셋으로 설정
    let adjustment = (avgRTT * 0.5) + (jitter * 2);
    
    // 네트워크 품질에 따른 가중치
    const qualityMultiplier = {
      'excellent': 0.5,
      'good': 0.7,
      'fair': 1.0,
      'poor': 1.5
    };
    
    adjustment *= qualityMultiplier[rttAnalysis.networkCondition] || 1.0;
    
    return Math.round(adjustment);
  }

  /**
   * 서버 부하 기반 조정값 계산
   */
  calculateLoadAdjustment(serverLoadAnalysis) {
    const loadMultipliers = {
      'low': 0,
      'medium': 500,
      'high': 1500,
      'critical': 3000,
      'unknown': 1000
    };
    
    const baseAdjustment = loadMultipliers[serverLoadAnalysis.serverLoad] || 1000;
    
    // 가용성이 낮으면 추가 오프셋
    const availabilityFactor = (100 - (serverLoadAnalysis.availability || 100)) / 100;
    const availabilityAdjustment = availabilityFactor * 1000;
    
    return Math.round(baseAdjustment + availabilityAdjustment);
  }

  /**
   * 과거 성공률 기반 조정값 계산
   */
  calculateHistoryAdjustment(historicalData) {
    if (!historicalData || historicalData.totalAttempts < 5) {
      return 0; // 데이터 부족시 조정 없음
    }
    
    const successRate = historicalData.successRate;
    
    // 성공률이 낮을수록 더 일찍 새로고침
    if (successRate < 50) return 2000;
    if (successRate < 70) return 1000;
    if (successRate < 85) return 500;
    if (successRate > 95) return -200; // 성공률이 매우 높으면 오프셋 감소
    
    return 0;
  }

  /**
   * 네트워크 안정성 기반 조정값 계산
   */
  calculateStabilityAdjustment(rttAnalysis) {
    const stdDev = rttAnalysis.stdDev;
    const packetLossRate = parseFloat(rttAnalysis.packetLossRate);
    
    let adjustment = 0;
    
    // 표준편차가 클수록 불안정
    if (stdDev > 50) adjustment += 1000;
    else if (stdDev > 20) adjustment += 500;
    
    // 패킷 손실률이 높을수록 불안정
    if (packetLossRate > 5) adjustment += 1500;
    else if (packetLossRate > 1) adjustment += 500;
    
    return Math.round(adjustment);
  }

  /**
   * 시간대별 트래픽 기반 조정값 계산
   */
  calculateTrafficAdjustment(currentTime) {
    const hour = currentTime.getHours();
    
    // 피크 시간대 (오전 9-11시, 오후 6-8시)
    if ((hour >= 9 && hour <= 11) || (hour >= 18 && hour <= 20)) {
      return 1000; // 피크 시간대에는 1초 추가
    }
    
    // 점심시간 (12-1시)
    if (hour >= 12 && hour <= 13) {
      return 500;
    }
    
    // 심야시간 (0-6시)
    if (hour >= 0 && hour <= 6) {
      return -300; // 트래픽이 적은 시간대는 오프셋 감소
    }
    
    return 0; // 일반 시간대
  }

  /**
   * 최적 새로고침 시간 계산
   */
  calculateOptimalRefreshTime(targetTime, offset, currentTime) {
    const target = new Date(targetTime);
    const optimal = new Date(target.getTime() - offset);
    
    // 현재 시간보다 과거면 즉시 새로고침으로 설정
    if (optimal.getTime() <= currentTime.timestamp) {
      return {
        optimalTime: new Date(currentTime.timestamp + 1000), // 1초 후
        timeUntilRefresh: 1000,
        isImmediate: true
      };
    }
    
    return {
      optimalTime: optimal,
      timeUntilRefresh: optimal.getTime() - currentTime.timestamp,
      isImmediate: false
    };
  }

  /**
   * 신뢰도 점수 계산
   */
  calculateConfidenceScore(networkAnalysis, historicalData, offset) {
    let confidence = 0.5; // 기본 50%
    
    // 네트워크 품질 기반 신뢰도
    const networkConfidence = {
      'excellent': 0.95,
      'good': 0.85,
      'fair': 0.70,
      'poor': 0.50
    };
    
    confidence = networkConfidence[networkAnalysis.rtt.networkCondition] || 0.5;
    
    // 과거 데이터 기반 조정
    if (historicalData && historicalData.totalAttempts >= 10) {
      const historyConfidence = historicalData.successRate / 100;
      confidence = (confidence + historyConfidence) / 2; // 평균
    }
    
    // 서버 부하 기반 조정
    const loadPenalty = {
      'low': 0,
      'medium': -0.05,
      'high': -0.15,
      'critical': -0.30,
      'unknown': -0.10
    };
    
    confidence += loadPenalty[networkAnalysis.serverLoad.serverLoad] || -0.10;
    
    // 오프셋이 극단적이면 신뢰도 감소
    if (offset > 5000 || offset < 1000) {
      confidence -= 0.1;
    }
    
    return Math.max(0.1, Math.min(0.99, confidence));
  }

  /**
   * 결과 검증 및 조정
   */
  validateAndAdjustResult(result) {
    const {
      targetUrl,
      targetTime,
      currentTime,
      optimalRefreshTime,
      dynamicOffset,
      confidenceScore,
      networkAnalysis,
      siteInfo,
      historicalData
    } = result;
    
    // 추가 권장사항 생성
    const recommendations = this.generateRecommendations(
      networkAnalysis,
      confidenceScore,
      dynamicOffset
    );
    
    // 알림 설정 제안
    const alertSettings = this.generateAlertSettings(optimalRefreshTime.timeUntilRefresh);
    
    return {
      success: true,
      targetUrl,
      siteName: siteInfo.name,
      targetTime: new Date(targetTime).toISOString(),
      currentTime: currentTime.serverTime,
      
      // 핵심 결과
      optimalRefreshTime: optimalRefreshTime.optimalTime.toISOString(),
      refreshInterval: dynamicOffset,
      timeUntilRefresh: optimalRefreshTime.timeUntilRefresh,
      confidenceScore: Math.round(confidenceScore * 100),
      
      // 상세 분석
      networkAnalysis: {
        condition: networkAnalysis.rtt.networkCondition,
        averageRTT: Math.round(networkAnalysis.rtt.average),
        jitter: Math.round(networkAnalysis.rtt.jitter),
        packetLoss: networkAnalysis.rtt.packetLossRate,
        serverLoad: networkAnalysis.serverLoad.serverLoad
      },
      
      // 권장사항
      recommendations,
      alertSettings,
      
      // 메타데이터
      calculatedAt: new Date().toISOString(),
      algorithm: 'dynamic_adaptive',
      version: '1.0'
    };
  }

  /**
   * 권장사항 생성
   */
  generateRecommendations(networkAnalysis, confidenceScore, offset) {
    const recommendations = [];
    
    if (confidenceScore > 0.9) {
      recommendations.push("매우 높은 신뢰도입니다. 정확한 타이밍으로 접속하세요.");
    } else if (confidenceScore > 0.7) {
      recommendations.push("높은 신뢰도입니다. 계산된 시간에 접속을 시도하세요.");
    } else if (confidenceScore > 0.5) {
      recommendations.push("보통 신뢰도입니다. 여러 번 시도할 준비를 하세요.");
    } else {
      recommendations.push("낮은 신뢰도입니다. 네트워크 상태를 확인하거나 다른 시간을 고려하세요.");
    }
    
    if (offset > 5000) {
      recommendations.push("네트워크 상태가 좋지 않아 일찍 새로고침이 필요합니다.");
    }
    
    if (networkAnalysis.rtt.networkCondition === 'poor') {
      recommendations.push("네트워크 연결을 개선하거나 다른 네트워크를 이용하세요.");
    }
    
    return recommendations;
  }

  /**
   * 알림 설정 제안
   */
  generateAlertSettings(timeUntilRefresh) {
    const alerts = [];
    
    if (timeUntilRefresh > 300000) { // 5분 이상
      alerts.push({
        type: 'reminder',
        time: timeUntilRefresh - 300000, // 5분 전 알림
        message: '5분 후 접속 준비를 시작하세요'
      });
    }
    
    if (timeUntilRefresh > 60000) { // 1분 이상
      alerts.push({
        type: 'preparation',
        time: timeUntilRefresh - 60000, // 1분 전 알림
        message: '1분 후 새로고침 준비를 하세요'
      });
    }
    
    if (timeUntilRefresh > 10000) { // 10초 이상
      alerts.push({
        type: 'ready',
        time: timeUntilRefresh - 10000, // 10초 전 알림
        message: '10초 후 새로고침하세요!'
      });
    }
    
    alerts.push({
      type: 'action',
      time: 0, // 정확한 시점
      message: '지금 새로고침하세요!',
      priority: 'high'
    });
    
    return alerts;
  }

  /**
   * 폴백 결과 생성 (에러 발생시)
   */
  getFallbackResult(targetUrl, targetTime, errorMessage) {
    const currentTime = new Date();
    const target = new Date(targetTime);
    const fallbackOffset = this.defaultOffset;
    const optimalTime = new Date(target.getTime() - fallbackOffset);
    
    return {
      success: false,
      error: errorMessage,
      targetUrl,
      targetTime: target.toISOString(),
      currentTime: currentTime.toISOString(),
      optimalRefreshTime: optimalTime.toISOString(),
      refreshInterval: fallbackOffset,
      timeUntilRefresh: optimalTime.getTime() - currentTime.getTime(),
      confidenceScore: 50,
      networkAnalysis: null,
      recommendations: [
        "네트워크 분석에 실패했습니다. 기본값을 사용합니다.",
        "네트워크 상태를 확인하고 다시 시도해보세요."
      ],
      alertSettings: this.generateAlertSettings(optimalTime.getTime() - currentTime.getTime()),
      calculatedAt: new Date().toISOString(),
      algorithm: 'fallback',
      version: '1.0'
    };
  }

  /**
   * 사이트 정보 조회
   */
  async getSiteInfo(targetUrl) {
    try {
      const result = await pool.query(
        'SELECT * FROM sites WHERE url = $1 OR url LIKE $2',
        [targetUrl, `%${new URL(targetUrl).hostname}%`]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      // 사이트가 없으면 기본값으로 생성
      return {
        id: null,
        url: targetUrl,
        name: new URL(targetUrl).hostname,
        optimal_offset: this.defaultOffset,
        category: 'general'
      };
      
    } catch (error) {
      console.error('사이트 정보 조회 실패:', error);
      return {
        id: null,
        url: targetUrl,
        name: 'Unknown Site',
        optimal_offset: this.defaultOffset,
        category: 'general'
      };
    }
  }

  /**
   * 과거 성능 데이터 조회
   */
  async getHistoricalPerformance(siteId, userId = null) {
    if (!siteId) return null;
    
    try {
      let query = `
        SELECT 
          COUNT(*) as total_attempts,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_attempts,
          AVG(rtt) as avg_rtt,
          AVG(optimal_offset) as avg_optimal_offset,
          MAX(created_at) as last_attempt
        FROM access_logs 
        WHERE site_id = $1
      `;
      
      const params = [siteId];
      
      if (userId) {
        query += ' AND user_id = $2';
        params.push(userId);
      }
      
      query += ' AND created_at > NOW() - INTERVAL \'30 days\''; // 최근 30일
      
      const result = await pool.query(query, params);
      
      if (result.rows.length > 0 && result.rows[0].total_attempts > 0) {
        const data = result.rows[0];
        return {
          totalAttempts: parseInt(data.total_attempts),
          successfulAttempts: parseInt(data.successful_attempts),
          successRate: (parseInt(data.successful_attempts) / parseInt(data.total_attempts)) * 100,
          avgRTT: parseFloat(data.avg_rtt) || 0,
          avgOptimalOffset: parseFloat(data.avg_optimal_offset) || this.defaultOffset,
          lastAttempt: data.last_attempt
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('과거 성능 데이터 조회 실패:', error);
      return null;
    }
  }

  /**
   * 접속 결과 로깅
   */
  async logAccessAttempt(userId, siteId, targetTime, actualAccessTime, rtt, success, optimalOffset, confidenceScore) {
    try {
      await pool.query(`
        INSERT INTO access_logs 
        (user_id, site_id, target_time, rtt, success, optimal_offset, confidence_score ,access_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [userId, siteId, targetTime, rtt, success, optimalOffset, confidenceScore]);
      
      // 사이트 통계 업데이트
      if (siteId) {
        await this.updateSiteStatistics(siteId);
      }
      
    } catch (error) {
      console.error('접속 로그 저장 실패:', error);
    }
  }

  /**
   * 사이트 통계 업데이트
   */
  async updateSiteStatistics(siteId) {
    try {
      await pool.query(`
        UPDATE sites SET 
          usage_count = (SELECT COUNT(*) FROM access_logs WHERE site_id = $1),
          average_rtt = (SELECT AVG(rtt) FROM access_logs WHERE site_id = $1 AND rtt IS NOT NULL),
          success_rate = (
            SELECT 
              CASE 
                WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)) * 100
                ELSE 0 
              END
            FROM access_logs WHERE site_id = $1
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [siteId]);
    } catch (error) {
      console.error('사이트 통계 업데이트 실패:', error);
    }
  }

  /**
   * 실시간 인터벌 조정 (학습 기반)
   */
  async adjustIntervalBasedOnRealtimeData(targetUrl, currentOffset) {
    try {
      // 실시간 네트워크 상태 빠른 체크
      const quickRTT = await this.networkService.measureRTT(targetUrl, 2);
      
      let adjustment = 0;
      
      // RTT가 이전 계산시보다 크게 증가했으면 오프셋 증가
      if (quickRTT.average > 200) {
        adjustment = Math.min(1000, quickRTT.average * 2);
      } else if (quickRTT.average < 50) {
        adjustment = -Math.min(500, currentOffset * 0.1);
      }
      
      const adjustedOffset = Math.max(
        this.minOffset, 
        Math.min(this.maxOffset, currentOffset + adjustment)
      );
      
      return {
        originalOffset: currentOffset,
        adjustedOffset,
        adjustment,
        reason: adjustment > 0 ? 'network_degradation' : 'network_improvement',
        rttData: quickRTT
      };
      
    } catch (error) {
      console.error('실시간 인터벌 조정 실패:', error);
      return {
        originalOffset: currentOffset,
        adjustedOffset: currentOffset,
        adjustment: 0,
        reason: 'adjustment_failed',
        error: error.message
      };
    }
  }

  /**
   * 배치 인터벌 계산 (여러 사이트 동시 처리)
   */
  async calculateMultipleIntervals(requests) {
    const results = await Promise.allSettled(
      requests.map(req => this.calculateOptimalInterval(
        req.targetUrl, 
        req.targetTime, 
        req.userId
      ))
    );
    
    return results.map((result, index) => ({
      request: requests[index],
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * 인터벌 계산 성능 벤치마크
   */
  async benchmarkCalculationPerformance(targetUrl, iterations = 5) {
    const results = [];
    const targetTime = new Date(Date.now() + 600000).toISOString(); // 10분 후
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const result = await this.calculateOptimalInterval(targetUrl, targetTime);
        const executionTime = Date.now() - startTime;
        
        results.push({
          iteration: i + 1,
          executionTime,
          success: true,
          confidenceScore: result.confidenceScore,
          refreshInterval: result.refreshInterval
        });
        
      } catch (error) {
        results.push({
          iteration: i + 1,
          executionTime: Date.now() - startTime,
          success: false,
          error: error.message
        });
      }
    }
    
    const successfulResults = results.filter(r => r.success);
    
    return {
      totalIterations: iterations,
      successfulIterations: successfulResults.length,
      averageExecutionTime: successfulResults.reduce((sum, r) => sum + r.executionTime, 0) / successfulResults.length,
      minExecutionTime: Math.min(...successfulResults.map(r => r.executionTime)),
      maxExecutionTime: Math.max(...successfulResults.map(r => r.executionTime)),
      averageConfidence: successfulResults.reduce((sum, r) => sum + r.confidenceScore, 0) / successfulResults.length,
      results
    };
  }
}

module.exports = IntervalService;
