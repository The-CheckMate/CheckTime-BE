// 네트워크 측정 서비스를 위해서...
const ping = require('ping');
const { Pool } = require('pg');
const { URL } = require('url');

const netTcp = require('net');
const { error } = require('console');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class NetworkService {
  constructor() {
    this.maxSamples = 10; // 최대 RTT 샘플 수
    this.defaultTimeout = 5000; // 기본 타임아웃 (ms)
  }

  /**
   * RTT 측정 (다중 샘플링)
   */
  async measureRTT(targetUrl, sampleCount = 5) {
    try {
      const parsedUrl = new URL(targetUrl);
      const hostname = parsedUrl.hostname;
      
      console.log(`RTT 측정 시작: ${hostname} (${sampleCount}개 샘플)`);
      
      const samples = [];
      //const results = [];
      
      const tasts = [];

      for (let i = 0; i < sampleCount; i++) {
        tasts.push(async () => {
          try {
            const startTime = Date.now();
            const result = await this.singlePing(hostname);
            const endTime = Date.now();

            if (result.alive) { //에러 발생 위치. ping만 실패하는것으로 보아 icmp 보안 문제인듯
              const rtt = parseFloat(result.time);
              samples.push(rtt);
              return {
                attempt: i + 1,
                rtt,
                success: true,
                timestamp: new Date()
              };
            } else { 
              // measureRTTtcp 함수 실행
              const tcpRtt = await this.measureTcp(hostname,80,this.defaultTimeout);
              console.log(tcpRtt);
              if(tcpRtt!=null){  
              samples.push(tcpRtt);
              return {
                  attempt: i + 1,
                  tcpRtt,
                  success: true,
                  timestamp: new Date()
                };
              }else{
                return {
                  attempt: i + 1,
                  rtt: null,
                  success: false,
                  timestamp: new Date()
                };
              }
            }
          } catch (error) {
            console.error(`RTT 측정 실패 (시도 ${i + 1}):`, error.message);
            return{
              attempt: i + 1,
              rtt: null,
              success: false,
              error: error.message,
              timestamp: new Date()
            };
          }
        });

        // 연속 요청 간 간격
        if (i < sampleCount - 1) {
          await this.delay(100);
        }
      }
      const results = await Promise.all(tasts.map(fn =>fn()));

      
      if (samples.length === 0) {
        throw new Error('모든 RTT 측정 실패');
      }
      
      // 통계 계산
      const stats = this.calculateRTTStats(samples);
      
      // 네트워크 상태 분석
      const networkCondition = this.analyzeNetworkCondition(stats, results.length, samples.length);
      
      // 결과 로깅
      await this.logNetworkPerformance(targetUrl, samples, stats, networkCondition);
      
      console.log(`RTT 측정 완료: 평균 ${stats.average.toFixed(2)}ms`);
      
      return {
        targetUrl,
        hostname,
        samples,
        ...stats,
        networkCondition,
        packetLossRate: ((results.length - samples.length) / results.length * 100).toFixed(2),
        sampleCount: samples.length,
        totalAttempts: results.length,
        results,
        measuredAt: new Date()
      };
      
    } catch (error) {
      console.error('RTT 측정 중 오류:', error);
      throw new Error(`RTT 측정 실패: ${error.message}`);
    }
  }

  /**
   * tcp 연결 실행. rtt측정 오류 보완
   */
  async measureTcp(hostname, port = 80, timeout){
    return new Promise((resolve) => {
      const socket = new netTcp.Socket();
      //const startT = Date.now();
      const startT = process.hrtime();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        //const endT = Date.now();
        const endT = process.hrtime(startT);
        const rtt = (endT[0]*1000)+(endT[1]/1e6); //밀리초 변환 
        setImmediate(() => socket.destroy());
        resolve(rtt);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(null);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(null);
      });
      socket.connect(port, hostname); //tcp 연결 성공
    });
  }

  /**
   * 단일 ping 실행
   */
  async singlePing(hostname) {
    return new Promise((resolve, reject) => {
      ping.sys.probe(hostname, (isAlive, error) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (isAlive) {
          // ping 명령어로 정확한 RTT 측정
          ping.promise.probe(hostname, {
            timeout: this.defaultTimeout / 1000, // 초 단위
            min_reply: 1
          }).then((result) => {
            resolve(result);
          }).catch(reject);
        } else {
          resolve({ alive: false });
        }
      });
    });
  }

  /**
   * RTT 통계 계산
   */
  calculateRTTStats(samples) {
    if (samples.length === 0) {
      throw new Error('RTT 샘플이 없습니다');
    }
    
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, rtt) => acc + rtt, 0);
    
    return {
      average: sum / samples.length,
      min: Math.min(...samples),
      max: Math.max(...samples),
      median: this.calculateMedian(sorted),
      stdDev: this.calculateStandardDeviation(samples),
      jitter: this.calculateJitter(samples),
      samples: samples.length
    };
  }

  /**
   * 중앙값 계산
   */
  calculateMedian(sortedArray) {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 !== 0 
      ? sortedArray[mid] 
      : (sortedArray[mid - 1] + sortedArray[mid]) / 2;
  }

  /**
   * 표준편차 계산
   */
  calculateStandardDeviation(samples) {
    const mean = samples.reduce((acc, val) => acc + val, 0) / samples.length;
    const squaredDiffs = samples.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / samples.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * 지터(Jitter) 계산
   */
  calculateJitter(samples) {
    if (samples.length < 2) return 0;
    
    const delayVariations = [];
    for (let i = 1; i < samples.length; i++) {
      delayVariations.push(Math.abs(samples[i] - samples[i - 1]));
    }
    
    return delayVariations.reduce((acc, val) => acc + val, 0) / delayVariations.length;
  }

  /**
   * 네트워크 상태 분석
   */
  analyzeNetworkCondition(stats, totalAttempts, successfulAttempts) {
    const packetLossRate = ((totalAttempts - successfulAttempts) / totalAttempts) * 100;
    const avgRTT = stats.average;
    const jitter = stats.jitter;
    
    // 점수 기반 평가 시스템
    let score = 100;
    
    // RTT 기반 점수 차감
    if (avgRTT > 200) score -= 40;
    else if (avgRTT > 100) score -= 25;
    else if (avgRTT > 50) score -= 15;
    else if (avgRTT > 20) score -= 5;
    
    // 패킷 손실률 기반 점수 차감
    if (packetLossRate > 10) score -= 30;
    else if (packetLossRate > 5) score -= 20;
    else if (packetLossRate > 1) score -= 10;
    
    // 지터 기반 점수 차감
    if (jitter > 50) score -= 20;
    else if (jitter > 20) score -= 10;
    else if (jitter > 10) score -= 5;
    
    // 상태 결정
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * 크리스티안 알고리즘 구현
   */
  async applyChristianAlgorithm(targetUrl, samples = 5) {
    try {
      const measurements = [];
      
      for (let i = 0; i < samples; i++) {
        const t1 = Date.now(); // 요청 전 시간
        
        // HTTP 요청으로 서버 시간 측정
        const response = await this.httpTimeMeasurement(targetUrl);
        
        const t4 = Date.now(); // 응답 후 시간
        const t2 = response.requestTime; // 서버에서 요청 받은 시간
        const t3 = response.responseTime; // 서버에서 응답 보낸 시간
        
        const rtt = t4 - t1;
        const networkDelay = rtt / 2;
        const serverProcessingTime = t3 - t2;
        const estimatedServerTime = t2 + networkDelay;
        const clockOffset = estimatedServerTime - t1;
        
        measurements.push({
          t1, t2, t3, t4,
          rtt,
          networkDelay,
          serverProcessingTime,
          clockOffset,
          accuracy: networkDelay // 정확도는 네트워크 지연의 절반
        });
        
        await this.delay(200); // 요청 간 간격
      }
      
      // 가장 정확한 측정값 선택 (RTT가 가장 작은 값)
      const bestMeasurement = measurements.reduce((best, current) => 
        current.rtt < best.rtt ? current : best
      );
      
      // 평균 오프셋 계산 (이상값 제거)
      const offsets = measurements.map(m => m.clockOffset);
      const filteredOffsets = this.removeOutliers(offsets);
      const averageOffset = filteredOffsets.reduce((sum, offset) => sum + offset, 0) / filteredOffsets.length;
      
      return {
        measurements,
        bestMeasurement,
        averageOffset,
        accuracy: bestMeasurement.accuracy,
        sampleCount: measurements.length,
        algorithm: 'Christian'
      };
      
    } catch (error) {
      throw new Error(`크리스티안 알고리즘 실행 실패: ${error.message}`);
    }
  }

  /**
   * HTTP 기반 시간 측정
   */
  async httpTimeMeasurement(targetUrl) {
    // 실제로는 타겟 서버의 시간 API를 호출해야 하지만,
    // 여기서는 시뮬레이션으로 구현
    const requestTime = Date.now();
    
    // 실제 HTTP 요청 시뮬레이션
    await this.delay(Math.random() * 50 + 10); // 10-60ms 지연
    
    const responseTime = Date.now();
    
    return {
      requestTime,
      responseTime,
      serverTime: responseTime // 실제로는 서버에서 반환하는 시간
    };
  }

  /**
   * 이상값 제거
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
   * 네트워크 성능 로그 저장
   */
  async logNetworkPerformance(targetUrl, samples, stats, condition) {
    try {
      const packetLossRate = 0; // 실제로는 계산된 값 사용
      
      await pool.query(`
        INSERT INTO network_performance_logs 
        (target_url, rtt_samples, average_rtt, min_rtt, max_rtt, packet_loss_rate, network_condition)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        targetUrl,
        samples,
        stats.average,
        stats.min,
        stats.max,
        packetLossRate,
        condition
      ]);
    } catch (error) {
      console.error('네트워크 성능 로그 저장 실패:', error);
    }
  }

  /**
   * 서버 부하 분석
   */
  async analyzeServerLoad(targetUrl, samples = 3) {
    try {
      const loadMeasurements = [];
      
      for (let i = 0; i < samples; i++) {
        const startTime = Date.now();
        
        // HTTP HEAD 요청으로 서버 응답 시간 측정
        try {
          const response = await this.httpHeadRequest(targetUrl);
          const responseTime = Date.now() - startTime;
          
          loadMeasurements.push({
            responseTime,
            statusCode: response.statusCode || 200,
            success: true,
            timestamp: new Date()
          });
        } catch (error) {
          loadMeasurements.push({
            responseTime: null,
            statusCode: null,
            success: false,
            error: error.message,
            timestamp: new Date()
          });
        }
        
        await this.delay(500); // 요청 간 간격
      }
      
      const successfulMeasurements = loadMeasurements.filter(m => m.success);
      
      if (successfulMeasurements.length === 0) {
        return {
          serverLoad: 'unknown',
          avgResponseTime: null,
          availability: 0,
          measurements: loadMeasurements
        };
      }
      
      const avgResponseTime = successfulMeasurements.reduce((sum, m) => sum + m.responseTime, 0) / successfulMeasurements.length;
      const availability = (successfulMeasurements.length / loadMeasurements.length) * 100;
      
      // 서버 부하 판정
      let serverLoad = 'low';
      if (avgResponseTime > 2000) serverLoad = 'critical';
      else if (avgResponseTime > 1000) serverLoad = 'high';
      else if (avgResponseTime > 500) serverLoad = 'medium';
      
      return {
        serverLoad,
        avgResponseTime,
        availability,
        measurements: loadMeasurements,
        analyzedAt: new Date()
      };
      
    } catch (error) {
      throw new Error(`서버 부하 분석 실패: ${error.message}`);
    }
  }

  /**
   * HTTP HEAD 요청 (서버 부하 측정용)
   */
  async httpHeadRequest(url) {
    // 실제 구현에서는 fetch 또는 axios 사용
    return new Promise((resolve) => {
      // 시뮬레이션
      setTimeout(() => {
        resolve({ statusCode: 200 });
      }, Math.random() * 200 + 50); // 50-250ms 응답 시간
    });
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 종합 네트워크 분석
   */
  async comprehensiveNetworkAnalysis(targetUrl) {
    console.log(`종합 네트워크 분석 시작: ${targetUrl}`);
    
    try {
      const [rttAnalysis, christianResult, serverLoadAnalysis] = await Promise.all([
        this.measureRTT(targetUrl, 5),
        this.applyChristianAlgorithm(targetUrl, 3),
        this.analyzeServerLoad(targetUrl, 3)
      ]);
      
      // 종합 점수 계산
      const overallScore = this.calculateOverallNetworkScore(rttAnalysis, serverLoadAnalysis);
      
      return {
        targetUrl,
        rtt: rttAnalysis,
        clockSync: christianResult,
        serverLoad: serverLoadAnalysis,
        overallScore,
        recommendation: this.generateNetworkRecommendation(overallScore, rttAnalysis, serverLoadAnalysis),
        analyzedAt: new Date()
      };
      
    } catch (error) {
      console.error('종합 네트워크 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 종합 네트워크 점수 계산
   */
  calculateOverallNetworkScore(rttAnalysis, serverLoadAnalysis) {
    let score = 100;
    
    // RTT 점수 반영 (40%)
    const rttScore = this.getConditionScore(rttAnalysis.networkCondition);
    score -= (100 - rttScore) * 0.4;
    
    // 서버 부하 점수 반영 (30%)
    const loadScore = this.getLoadScore(serverLoadAnalysis.serverLoad);
    score -= (100 - loadScore) * 0.3;
    
    // 가용성 점수 반영 (30%)
    const availabilityScore = serverLoadAnalysis.availability || 0;
    score -= (100 - availabilityScore) * 0.3;
    
    return Math.max(0, Math.round(score));
  }

  /**
   * 네트워크 상태별 점수 반환
   */
  getConditionScore(condition) {
    const scores = {
      'excellent': 95,
      'good': 80,
      'fair': 60,
      'poor': 30
    };
    return scores[condition] || 0;
  }

  /**
   * 서버 부하별 점수 반환
   */
  getLoadScore(load) {
    const scores = {
      'low': 95,
      'medium': 75,
      'high': 50,
      'critical': 20,
      'unknown': 0
    };
    return scores[load] || 0;
  }

  /**
   * 네트워크 권장사항 생성
   */
  generateNetworkRecommendation(score, rttAnalysis, serverLoadAnalysis) {
    const recommendations = [];
    
    if (score >= 90) {
      recommendations.push("네트워크 상태가 매우 우수합니다. 정확한 타이밍으로 접속하세요.");
    } else if (score >= 70) {
      recommendations.push("네트워크 상태가 양호합니다. 약간의 여유시간을 두고 접속하세요.");
    } else if (score >= 50) {
      recommendations.push("네트워크 상태가 보통입니다. 여러 번 시도할 준비를 하세요.");
    } else {
      recommendations.push("네트워크 상태가 좋지 않습니다. 다른 시간대나 다른 네트워크를 고려하세요.");
    }
    
    // 구체적인 권장사항
    if (rttAnalysis.average > 100) {
      recommendations.push(`높은 지연시간(${rttAnalysis.average.toFixed(0)}ms)으로 인해 더 일찍 접속을 시도하세요.`);
    }
    
    if (rttAnalysis.packetLossRate > 5) {
      recommendations.push(`패킷 손실률이 높습니다(${rttAnalysis.packetLossRate}%). 네트워크 연결을 확인하세요.`);
    }
    
    if (serverLoadAnalysis.serverLoad === 'high' || serverLoadAnalysis.serverLoad === 'critical') {
      recommendations.push("서버 부하가 높습니다. 트래픽이 적은 시간대를 이용하세요.");
    }
    
    return recommendations;
  }
}

module.exports = NetworkService;