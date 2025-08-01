const express = require('express');
const { Pool } = require('pg');
const TimeService = require('../services/TimeService');
const { body, query, validationResult } = require('express-validator');
require('dotenv').config();

const router = express.Router();
const timeService = new TimeService();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 현재 서버 시간 반환 (NTP 동기화된 정확한 시간)
router.get('/current', async (req, res) => {
  try {
    const currentTime = await timeService.getCurrentTime();
    
    // 시간 조회 로그 저장
    await pool.query(`
      INSERT INTO ntp_sync_logs (ntp_server, offset_ms, accuracy_ms, success, sync_timestamp)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, ['system_time', currentTime.offset, currentTime.accuracy, true]);

    res.json({
      success: true,
      data: {
        serverTime: currentTime.serverTime,
        timestamp: currentTime.timestamp,
        timezone: currentTime.timezone,
        offset: currentTime.offset,
        accuracy: currentTime.accuracy,
        lastSyncTime: currentTime.lastSyncTime,
        source: currentTime.source
      }
    });

  } catch (error) {
    console.error('서버 시간 조회 실패:', error);
    
    // 실패 로그 저장
    await pool.query(`
      INSERT INTO ntp_sync_logs (ntp_server, success, error_message, sync_timestamp)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, ['system_time', false, error.message]).catch(console.error);

    res.status(500).json({
      success: false,
      message: '서버 시간을 가져오는데 실패했습니다.',
      error: error.message
    });
  }
});

// 시간 동기화 요청 처리 (클라이언트-서버 RTT 측정)
router.post('/sync', [
  body('clientTime').isISO8601().withMessage('유효한 클라이언트 시간을 입력해주세요'),
  body('userAgent').optional().isString(),
  body('timezone').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { clientTime, userAgent, timezone } = req.body;
    const receivedAt = Date.now();
    
    // 정확한 서버 시간 조회
    const currentTime = await timeService.getCurrentTime();
    const serverTime = currentTime.timestamp;
    
    // RTT 계산 (클라이언트 요청 시간과 현재 시간의 차이)
    const clientTimestamp = new Date(clientTime).getTime();
    const rtt = receivedAt - clientTimestamp;
    
    // 시간 오프셋 계산 (서버 시간 - 클라이언트 시간)
    const timeOffset = serverTime - clientTimestamp;
    
    // 동기화 정확도 계산
    const accuracy = Math.abs(rtt) < 100 ? 'high' : Math.abs(rtt) < 500 ? 'medium' : 'low';
    
    // 동기화 결과 로그 저장
    await pool.query(`
      INSERT INTO ntp_sync_logs (
        ntp_server, offset_ms, accuracy_ms, rtt_ms, success, sync_timestamp
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, ['client_sync', timeOffset, rtt / 2, rtt, true]);

    res.json({
      success: true,
      data: {
        clientTime,
        serverTime: currentTime.serverTime,
        receivedAt: new Date(receivedAt).toISOString(),
        rtt,
        timeOffset,
        networkDelay: rtt / 2,
        syncAccuracy: accuracy,
        recommendations: generateSyncRecommendations(rtt, timeOffset)
      }
    });

  } catch (error) {
    console.error('시간 동기화 실패:', error);
    res.status(500).json({
      success: false,
      message: '시간 동기화에 실패했습니다.',
      error: error.message
    });
  }
});

// NTP 동기화 실행
router.post('/ntp-sync', async (req, res) => {
  try {
    const syncResult = await timeService.syncWithNTP();
    
    res.json({
      success: true,
      data: syncResult,
      message: 'NTP 동기화가 완료되었습니다.'
    });

  } catch (error) {
    console.error('NTP 동기화 실패:', error);
    res.status(500).json({
      success: false,
      message: 'NTP 동기화에 실패했습니다.',
      error: error.message
    });
  }
});

// 동기화 상태 확인
router.get('/sync-status', async (req, res) => {
  try {
    const status = timeService.getSyncStatus();
    
    // 최근 동기화 로그 조회
    const recentLogs = await pool.query(`
      SELECT 
        ntp_server, offset_ms, accuracy_ms, rtt_ms, success, 
        error_message, sync_timestamp
      FROM ntp_sync_logs 
      ORDER BY sync_timestamp DESC 
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        ...status,
        recentSyncLogs: recentLogs.rows
      }
    });

  } catch (error) {
    console.error('동기화 상태 확인 실패:', error);
    res.status(500).json({
      success: false,
      message: '동기화 상태 확인에 실패했습니다.',
      error: error.message
    });
  }
});

// 특정 시간대의 현재 시간
router.get('/timezone/:timezone', async (req, res) => {
  try {
    const { timezone } = req.params;
    
    // 시간대 유효성 검증
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 시간대입니다.'
      });
    }

    const timeInTimezone = timeService.getCurrentTimeInTimezone(timezone);
    
    res.json({
      success: true,
      data: timeInTimezone
    });

  } catch (error) {
    console.error('시간대별 시간 조회 실패:', error);
    res.status(400).json({
      success: false,
      message: '시간대별 시간 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 시간 차이 계산
router.post('/calculate-difference', [
  body('targetTime').isISO8601().withMessage('유효한 목표 시간을 입력해주세요')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { targetTime } = req.body;
    const difference = timeService.calculateTimeDifference(targetTime);
    
    res.json({
      success: true,
      data: {
        targetTime: new Date(targetTime).toISOString(),
        currentTime: new Date().toISOString(),
        ...difference,
        formatted: {
          days: Math.floor(Math.abs(difference.differenceMs) / (1000 * 60 * 60 * 24)),
          hours: Math.floor((Math.abs(difference.differenceMs) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((Math.abs(difference.differenceMs) % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((Math.abs(difference.differenceMs) % (1000 * 60)) / 1000)
        }
      }
    });

  } catch (error) {
    console.error('시간 차이 계산 실패:', error);
    res.status(500).json({
      success: false,
      message: '시간 차이 계산에 실패했습니다.',
      error: error.message
    });
  }
});

// 동기화 통계 조회
router.get('/sync-stats', [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('일수는 1-365 사이여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { days = 7 } = req.query;

    // 동기화 통계 조회
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN success THEN 1 END) as successful_syncs,
        AVG(ABS(offset_ms)) as avg_offset,
        AVG(accuracy_ms) as avg_accuracy,
        AVG(rtt_ms) as avg_rtt,
        MAX(sync_timestamp) as last_sync
      FROM ntp_sync_logs 
      WHERE sync_timestamp > CURRENT_DATE - INTERVAL '${days} days'
    `);

    // 서버별 통계
    const serverStatsResult = await pool.query(`
      SELECT 
        ntp_server,
        COUNT(*) as sync_count,
        COUNT(CASE WHEN success THEN 1 END) as success_count,
        AVG(ABS(offset_ms)) as avg_offset,
        AVG(accuracy_ms) as avg_accuracy
      FROM ntp_sync_logs 
      WHERE sync_timestamp > CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY ntp_server
      ORDER BY success_count DESC
    `);

    // 일별 동기화 통계
    const dailyStatsResult = await pool.query(`
      SELECT 
        DATE(sync_timestamp) as date,
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN success THEN 1 END) as successful_syncs,
        AVG(ABS(offset_ms)) as avg_offset
      FROM ntp_sync_logs 
      WHERE sync_timestamp > CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(sync_timestamp)
      ORDER BY date DESC
    `);

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        overall: {
          totalSyncs: parseInt(stats.total_syncs) || 0,
          successfulSyncs: parseInt(stats.successful_syncs) || 0,
          successRate: stats.total_syncs > 0 
            ? (parseInt(stats.successful_syncs) / parseInt(stats.total_syncs)) * 100 
            : 0,
          avgOffset: parseFloat(stats.avg_offset) || 0,
          avgAccuracy: parseFloat(stats.avg_accuracy) || 0,
          avgRTT: parseFloat(stats.avg_rtt) || 0,
          lastSync: stats.last_sync
        },
        byServer: serverStatsResult.rows,
        daily: dailyStatsResult.rows
      }
    });

  } catch (error) {
    console.error('동기화 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '동기화 통계 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 시간 정확도 검증
router.post('/validate-accuracy', [
  body('clientTime').isISO8601().withMessage('유효한 클라이언트 시간을 입력해주세요'),
  body('expectedAccuracy').optional().isFloat({ min: 0, max: 10000 }).withMessage('예상 정확도는 0-10000ms 사이여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { clientTime, expectedAccuracy = 1000 } = req.body;
    const currentTime = await timeService.getCurrentTime();
    
    const clientTimestamp = new Date(clientTime).getTime();
    const serverTimestamp = currentTime.timestamp;
    const timeDifference = Math.abs(serverTimestamp - clientTimestamp);
    
    const isAccurate = timeDifference <= expectedAccuracy;
    
    res.json({
      success: true,
      data: {
        clientTime,
        serverTime: currentTime.serverTime,
        timeDifference,
        expectedAccuracy,
        isAccurate,
        accuracy: isAccurate ? 'good' : 'poor',
        recommendation: isAccurate 
          ? '시간 정확도가 양호합니다.'
          : '시간 동기화가 필요합니다. NTP 동기화를 실행하세요.'
      }
    });

  } catch (error) {
    console.error('시간 정확도 검증 실패:', error);
    res.status(500).json({
      success: false,
      message: '시간 정확도 검증에 실패했습니다.',
      error: error.message
    });
  }
});

// 동기화 품질 평가
router.get('/sync-quality', async (req, res) => {
  try {
    const status = timeService.getSyncStatus();
    
    // 최근 동기화 데이터 조회
    const recentSyncs = await pool.query(`
      SELECT offset_ms, accuracy_ms, rtt_ms, success
      FROM ntp_sync_logs 
      WHERE sync_timestamp > NOW() - INTERVAL '1 hour'
      AND success = true
      ORDER BY sync_timestamp DESC
      LIMIT 20
    `);

    let quality = 'unknown';
    let score = 0;
    const recommendations = [];

    if (recentSyncs.rows.length === 0) {
      quality = 'poor';
      recommendations.push('최근 동기화 데이터가 없습니다. NTP 동기화를 실행하세요.');
    } else {
      const avgRtt = recentSyncs.rows.reduce((sum, row) => sum + parseFloat(row.rtt_ms || 0), 0) / recentSyncs.rows.length;
      const avgAccuracy = recentSyncs.rows.reduce((sum, row) => sum + parseFloat(row.accuracy_ms || 0), 0) / recentSyncs.rows.length;
      const successRate = recentSyncs.rows.length / 20 * 100; // 최대 20개 중 성공한 비율

      // 점수 계산
      if (avgRtt < 100) score += 40;
      else if (avgRtt < 500) score += 30;
      else if (avgRtt < 1000) score += 20;
      else score += 10;

      if (avgAccuracy < 50) score += 30;
      else if (avgAccuracy < 100) score += 25;
      else if (avgAccuracy < 200) score += 20;
      else score += 10;

      if (successRate >= 90) score += 30;
      else if (successRate >= 70) score += 20;
      else if (successRate >= 50) score += 10;

      // 품질 등급
      if (score >= 90) quality = 'excellent';
      else if (score >= 70) quality = 'good';
      else if (score >= 50) quality = 'fair';
      else quality = 'poor';

      // 권장사항 생성
      if (avgRtt > 1000) {
        recommendations.push('네트워크 지연이 높습니다. 네트워크 연결을 확인하세요.');
      }
      if (avgAccuracy > 200) {
        recommendations.push('동기화 정확도가 낮습니다. 더 많은 NTP 서버를 사용하세요.');
      }
      if (successRate < 70) {
        recommendations.push('동기화 성공률이 낮습니다. 네트워크 안정성을 확인하세요.');
      }
      if (recommendations.length === 0) {
        recommendations.push('시간 동기화 품질이 양호합니다.');
      }
    }

    res.json({
      success: true,
      data: {
        quality,
        score,
        syncStatus: status,
        recentSyncCount: recentSyncs.rows.length,
        recommendations,
        metrics: recentSyncs.rows.length > 0 ? {
          avgRtt: recentSyncs.rows.reduce((sum, row) => sum + parseFloat(row.rtt_ms || 0), 0) / recentSyncs.rows.length,
          avgAccuracy: recentSyncs.rows.reduce((sum, row) => sum + parseFloat(row.accuracy_ms || 0), 0) / recentSyncs.rows.length,
          successRate: recentSyncs.rows.length / 20 * 100
        } : null
      }
    });

  } catch (error) {
    console.error('동기화 품질 평가 실패:', error);
    res.status(500).json({
      success: false,
      message: '동기화 품질 평가에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * 동기화 권장사항 생성 함수
 */
function generateSyncRecommendations(rtt, timeOffset) {
  const recommendations = [];
  
  if (Math.abs(rtt) > 1000) {
    recommendations.push('네트워크 지연이 높습니다. 안정적인 네트워크 연결을 사용하세요.');
  }
  
  if (Math.abs(timeOffset) > 5000) {
    recommendations.push('시간 차이가 큽니다. 시스템 시간을 확인하고 NTP 동기화를 실행하세요.');
  }
  
  if (Math.abs(rtt) < 100 && Math.abs(timeOffset) < 1000) {
    recommendations.push('시간 동기화 상태가 양호합니다.');
  } else if (Math.abs(rtt) < 500) {
    recommendations.push('보통 수준의 동기화 상태입니다. 주기적인 동기화를 권장합니다.');
  }
  
  return recommendations;
}

module.exports = router;