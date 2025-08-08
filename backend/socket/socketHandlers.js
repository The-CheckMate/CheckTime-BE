// WebSocket 이벤트 핸들러
const TimeService = require('../services/TimeService');
const NetworkService = require('../services/NetworkService');
const IntervalService = require('../services/IntervalService');

const timeService = new TimeService();
const networkService = new NetworkService();
const intervalService = new IntervalService();

// 연결된 클라이언트 관리
const connectedClients = new Map();

/**
 * Socket.IO 이벤트 핸들러
 */
function socketHandlers(io, socket) {
  console.log(`클라이언트 연결됨: ${socket.id}`);
  
  // 클라이언트 정보 저장
  connectedClients.set(socket.id, {
    id: socket.id,
    connectedAt: new Date(),
    isTimeSync: false,
    currentTarget: null
  });

  // 연결 즉시 현재 시간 전송
  socket.emit('time_sync', {
    type: 'initial',
    ...timeService.getSyncStatus()
  });

  /**
   * 실시간 시간 동기화 요청
   */
  socket.on('request_time_sync', async () => {
    try {
      const currentTime = await timeService.getCurrentTime();
      socket.emit('time_sync', {
        type: 'response',
        ...currentTime
      });
      
      // 클라이언트 동기화 상태 업데이트
      const client = connectedClients.get(socket.id);
      if (client) {
        client.isTimeSync = true;
      }
      
    } catch (error) {
      socket.emit('error', {
        type: 'time_sync_failed',
        message: error.message
      });
    }
  });

  /**
   * 최적 인터벌 계산 요청
   */
  socket.on('calculate_interval', async (data) => {
    try {
      const { targetUrl, targetTime, userId } = data;
      
      if (!targetUrl || !targetTime) {
        socket.emit('error', {
          type: 'invalid_request',
          message: '필수 파라미터가 누락되었습니다'
        });
        return;
      }
      
      // 클라이언트 타겟 정보 업데이트
      const client = connectedClients.get(socket.id);
      if (client) {
        client.currentTarget = { targetUrl, targetTime };
      }
      
      // 계산 시작 알림
      socket.emit('calculation_started', {
        targetUrl,
        targetTime,
        message: '최적 인터벌 계산을 시작합니다...'
      });
      
      // 인터벌 계산 실행
      const result = await intervalService.calculateOptimalInterval(targetUrl, targetTime, userId);
      
      // 결과 전송
      socket.emit('interval_calculated', {
        success: true,
        data: result
      });
      
      // 카운트다운 시작
      startCountdown(socket, result);
      
    } catch (error) {
      socket.emit('error', {
        type: 'calculation_failed',
        message: error.message
      });
    }
  });

  /**
   * 실시간 네트워크 상태 모니터링 시작
   */
  socket.on('start_network_monitoring', async (data) => {
    try {
      const { targetUrl, interval = 30000 } = data; // 기본 30초 간격
      
      if (!targetUrl) {
        socket.emit('error', {
          type: 'invalid_request',
          message: 'targetUrl이 필요합니다'
        });
        return;
      }
      
      // 모니터링 시작
      const monitoringId = setInterval(async () => {
        try {
          const rttResult = await networkService.measureRTT(targetUrl, 3);
          
          socket.emit('network_status_update', {
            targetUrl,
            timestamp: new Date().toISOString(),
            rtt: {
              average: rttResult.average,
              condition: rttResult.networkCondition,
              packetLoss: rttResult.packetLossRate
            }
          });
          
        } catch (error) {
          socket.emit('network_monitoring_error', {
            targetUrl,
            error: error.message
          });
        }
      }, interval);
      
      // 클라이언트 연결 해제시 모니터링 정리
      socket.on('disconnect', () => {
        clearInterval(monitoringId);
      });
      
      // 모니터링 중지 이벤트
      socket.on('stop_network_monitoring', () => {
        clearInterval(monitoringId);
        socket.emit('network_monitoring_stopped', { targetUrl });
      });
      
      socket.emit('network_monitoring_started', {
        targetUrl,
        interval,
        message: '네트워크 모니터링이 시작되었습니다'
      });
      
    } catch (error) {
      socket.emit('error', {
        type: 'monitoring_failed',
        message: error.message
      });
    }
  });

  /**
   * 접속 결과 보고
   */
  socket.on('report_access_result', async (data) => {
    try {
      const {
        siteId,
        targetTime,
        actualAccessTime,
        success,
        rtt,
        optimalOffset,
        confidenceScore,
        userId
      } = data;
      
      // 접속 결과 로깅
      await intervalService.logAccessAttempt(
        userId,
        siteId,
        targetTime,
        actualAccessTime,
        rtt,
        success,
        optimalOffset,
        confidenceScore
      );
      
      socket.emit('access_result_logged', {
        success: true,
        message: '접속 결과가 기록되었습니다'
      });
      
      // 다른 클라이언트들에게 성공률 업데이트 브로드캐스트 (같은 사이트 모니터링 중인 경우)
      socket.broadcast.emit('site_stats_updated', {
        siteId,
        success,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      socket.emit('error', {
        type: 'logging_failed',
        message: error.message
      });
    }
  });

  /**
   * 연결 해제 처리
   */
  socket.on('disconnect', (reason) => {
    console.log(`클라이언트 연결 해제: ${socket.id} (${reason})`);
    
    // 클라이언트 정보 제거
    connectedClients.delete(socket.id);
    
    // 진행 중인 타이머들 정리
    clearClientTimers(socket.id);
  });

  /**
   * 에러 처리
   */
  socket.on('error', (error) => {
    console.error(`Socket 에러 (${socket.id}):`, error);
  });
}

/**
 * 카운트다운 시작
 */
function startCountdown(socket, intervalResult) {
  const { timeUntilRefresh, alertSettings } = intervalResult.data || intervalResult;
  
  if (timeUntilRefresh <= 0) {
    socket.emit('refresh_now', {
      message: '지금 새로고침하세요!',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // 알림 스케줄링
  alertSettings?.forEach(alert => {
    if (alert.time > 0) {
      setTimeout(() => {
        socket.emit('countdown_alert', {
          type: alert.type,
          message: alert.message,
          priority: alert.priority || 'normal',
          timestamp: new Date().toISOString()
        });
      }, alert.time);
    } else {
      // 즉시 실행 알림
      setTimeout(() => {
        socket.emit('refresh_now', {
          message: alert.message,
          priority: alert.priority || 'high',
          timestamp: new Date().toISOString()
        });
      }, timeUntilRefresh);
    }
  });
  
  // 실시간 카운트다운 업데이트 (1초마다)
  const countdownInterval = setInterval(() => {
    const client = connectedClients.get(socket.id);
    if (!client || !client.currentTarget) {
      clearInterval(countdownInterval);
      return;
    }
    
    const now = Date.now();
    const target = new Date(client.currentTarget.targetTime);
    const remaining = target.getTime() - now;
    
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      socket.emit('countdown_finished', {
        message: '목표 시간에 도달했습니다!',
        timestamp: new Date().toISOString()
      });
    } else {
      socket.emit('countdown_update', {
        remainingTime: remaining,
        remainingSeconds: Math.ceil(remaining / 1000),
        targetTime: target.toISOString(),
        timestamp: new Date().toISOString()
      });
    }
  }, 1000);
  
  // 연결 해제시 타이머 정리를 위해 저장
  if (!socket.timers) socket.timers = [];
  socket.timers.push(countdownInterval);
}

/**
 * 클라이언트 타이머들 정리
 */
function clearClientTimers(socketId) {
  // 각 소켓의 타이머들을 정리하는 로직
  // 실제 구현에서는 타이머 ID들을 추적하여 정리
}

/**
 * 전체 클라이언트에게 시간 동기화 브로드캐스트
 */
function broadcastTimeSync(io) {
  timeService.getCurrentTime().then(currentTime => {
    io.emit('time_sync', {
      type: 'broadcast',
      ...currentTime
    });
  }).catch(error => {
    console.error('시간 동기화 브로드캐스트 실패:', error);
  });
}

/**
 * 연결된 클라이언트 통계
 */
function getClientStats() {
  const stats = {
    totalConnected: connectedClients.size,
    syncedClients: 0,
    monitoringClients: 0
  };
  
  connectedClients.forEach(client => {
    if (client.isTimeSync) stats.syncedClients++;
    if (client.currentTarget) stats.monitoringClients++;
  });
  
  return stats;
}

module.exports = socketHandlers;
module.exports.broadcastTimeSync = broadcastTimeSync;
module.exports.getClientStats = getClientStats;