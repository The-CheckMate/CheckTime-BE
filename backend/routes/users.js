const express = require('express');
const { Pool } = require('pg');
const auth = require('../middlewares/auth');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 사용자 프로필 조회 (인증 필요)
router.get('/profile', auth.required, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT 
        id, email, username, timezone, preferences, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.'
      });
    }

    const user = result.rows[0];

    // 사용자 통계 조회
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success THEN 1 END) as successful_attempts,
        AVG(rtt) as avg_rtt,
        MAX(created_at) as last_access
      FROM access_logs 
      WHERE user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        ...user,
        stats: {
          totalAttempts: parseInt(stats.total_attempts) || 0,
          successfulAttempts: parseInt(stats.successful_attempts) || 0,
          successRate: stats.total_attempts > 0 
            ? (parseInt(stats.successful_attempts) / parseInt(stats.total_attempts)) * 100 
            : 0,
          avgRTT: parseFloat(stats.avg_rtt) || 0,
          lastAccess: stats.last_access
        }
      }
    });

  } catch (error) {
    console.error('사용자 프로필 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '사용자 정보를 가져오는데 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 프로필 업데이트 (인증 필요)
router.put('/profile', auth.required, [
  body('username').optional().isLength({ min: 2, max: 100 }).withMessage('사용자명은 2-100자 사이여야 합니다'),
  body('timezone').optional().isString().withMessage('시간대는 문자열이어야 합니다'),
  body('preferences').optional().isObject().withMessage('설정은 객체여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { username, timezone, preferences } = req.body;

    // 사용자명 중복 확인 (변경하는 경우)
    if (username) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: '이미 사용 중인 사용자명입니다.'
        });
      }
    }

    // 시간대 유효성 검증
    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 시간대입니다.'
        });
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (username !== undefined) {
      updateFields.push(`username = $${paramIndex}`);
      updateValues.push(username);
      paramIndex++;
    }

    if (timezone !== undefined) {
      updateFields.push(`timezone = $${paramIndex}`);
      updateValues.push(timezone);
      paramIndex++;
    }

    if (preferences !== undefined) {
      updateFields.push(`preferences = $${paramIndex}`);
      updateValues.push(JSON.stringify(preferences));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '업데이트할 필드가 없습니다.'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, username, timezone, preferences, updated_at
    `;

    const result = await pool.query(query, updateValues);

    res.json({
      success: true,
      data: result.rows[0],
      message: '프로필이 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('프로필 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      message: '프로필 업데이트에 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 설정 조회
router.get('/settings', auth.required, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT preferences, timezone
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    const user = result.rows[0];

    // 기본 설정과 병합
    const defaultSettings = {
      notifications: {
        email: true,
        push: true,
        optimalTimeAlerts: true,
        successReports: true
      },
      display: {
        theme: 'auto',
        language: 'ko',
        timeFormat: '24h'
      },
      sync: {
        autoSync: true,
        syncInterval: 300000, // 5분
        ntpServers: ['pool.ntp.org', 'time.google.com']
      }
    };

    const settings = {
      ...defaultSettings,
      ...user.preferences,
      timezone: user.timezone
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('사용자 설정 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '사용자 설정 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 설정 업데이트
router.put('/settings', auth.required, [
  body('settings').isObject().withMessage('설정은 객체여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { settings } = req.body;

    // 설정 유효성 검증
    if (settings.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: settings.timezone });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 시간대입니다.'
        });
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // preferences 업데이트
    if (settings.notifications || settings.display || settings.sync) {
      const preferences = {
        notifications: settings.notifications,
        display: settings.display,
        sync: settings.sync
      };
      
      updateFields.push(`preferences = $${paramIndex}`);
      updateValues.push(JSON.stringify(preferences));
      paramIndex++;
    }

    // timezone 업데이트
    if (settings.timezone) {
      updateFields.push(`timezone = $${paramIndex}`);
      updateValues.push(settings.timezone);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '업데이트할 설정이 없습니다.'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING preferences, timezone
    `;

    const result = await pool.query(query, updateValues);

    res.json({
      success: true,
      data: result.rows[0],
      message: '설정이 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('설정 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      message: '설정 업데이트에 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 통계 조회
router.get('/stats', auth.required, [
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

    const userId = req.user.id;
    const { days = 30 } = req.query;

    // 전체 통계
    const overallResult = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success THEN 1 END) as successful_attempts,
        AVG(rtt) as avg_rtt,
        AVG(confidence_score) as avg_confidence,
        MIN(access_time) as first_access,
        MAX(access_time) as last_access
      FROM access_logs 
      WHERE user_id = $1
        AND access_time > CURRENT_DATE - INTERVAL '${days} days'
    `, [userId]);

    // 일별 통계
    const dailyResult = await pool.query(`
      SELECT 
        DATE(access_time) as date,
        COUNT(*) as attempts,
        COUNT(CASE WHEN success THEN 1 END) as successes,
        AVG(rtt) as avg_rtt
      FROM access_logs 
      WHERE user_id = $1
        AND access_time > CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(access_time)
      ORDER BY date DESC
    `, [userId]);

    // 사이트별 통계
    const siteResult = await pool.query(`
      SELECT 
        s.name as site_name,
        s.url,
        COUNT(*) as attempts,
        COUNT(CASE WHEN al.success THEN 1 END) as successes,
        AVG(al.rtt) as avg_rtt
      FROM access_logs al
      JOIN sites s ON al.site_id = s.id
      WHERE al.user_id = $1
        AND al.access_time > CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY s.id, s.name, s.url
      ORDER BY attempts DESC
      LIMIT 10
    `, [userId]);

    // // 즐겨찾기 통계
    // const favoritesResult = await pool.query(`
    //   SELECT 
    //     COUNT(*) as total_favorites,
    //     COUNT(CASE WHEN uf.notification_enabled THEN 1 END) as notifications_enabled
    //   FROM user_favorites uf
    //   WHERE uf.user_id = $1
    // `, [userId]);

    const overall = overallResult.rows[0];
    // const favorites = favoritesResult.rows[0];

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        overall: {
          totalAttempts: parseInt(overall.total_attempts) || 0,
          successfulAttempts: parseInt(overall.successful_attempts) || 0,
          successRate: overall.total_attempts > 0 
            ? (parseInt(overall.successful_attempts) / parseInt(overall.total_attempts)) * 100 
            : 0,
          avgRTT: parseFloat(overall.avg_rtt) || 0,
          avgConfidence: parseFloat(overall.avg_confidence) || 0,
          firstAccess: overall.first_access,
          lastAccess: overall.last_access
        },
        // favorites: {
        //   totalFavorites: parseInt(favorites.total_favorites) || 0,
        //   notificationsEnabled: parseInt(favorites.notifications_enabled) || 0
        // },
        daily: dailyResult.rows.map(row => ({
          date: row.date,
          attempts: parseInt(row.attempts),
          successes: parseInt(row.successes),
          successRate: (parseInt(row.successes) / parseInt(row.attempts)) * 100,
          avgRTT: parseFloat(row.avg_rtt) || 0
        })),
        topSites: siteResult.rows.map(row => ({
          siteName: row.site_name,
          url: row.url,
          attempts: parseInt(row.attempts),
          successes: parseInt(row.successes),
          successRate: (parseInt(row.successes) / parseInt(row.attempts)) * 100,
          avgRTT: parseFloat(row.avg_rtt) || 0
        }))
      }
    });

  } catch (error) {
    console.error('사용자 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '사용자 통계 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 접속 기록 조회
router.get('/history', auth.required, [
  query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('제한은 1-100 사이여야 합니다'),
  query('siteId').optional().isInt().withMessage('사이트 ID는 정수여야 합니다'),
  query('success').optional().isBoolean().withMessage('성공 여부는 boolean이어야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { page = 1, limit = 20, siteId, success } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        al.*,
        s.name as site_name,
        s.url as site_url,
        s.category as site_category
      FROM access_logs al
      JOIN sites s ON al.site_id = s.id
      WHERE al.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (siteId) {
      query += ` AND al.site_id = $${paramIndex}`;
      params.push(siteId);
      paramIndex++;
    }

    if (success !== undefined) {
      query += ` AND al.success = $${paramIndex}`;
      params.push(success === 'true');
      paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) FROM access_logs al WHERE al.user_id = $1';
    const countParams = [userId];
    let countParamIndex = 2;

    if (siteId) {
      countQuery += ` AND al.site_id = $${countParamIndex}`;
      countParams.push(siteId);
      countParamIndex++;
    }

    if (success !== undefined) {
      countQuery += ` AND al.success = $${countParamIndex}`;
      countParams.push(success === 'true');
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        history: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('접속 기록 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '접속 기록 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 계정 삭제 (인증 필요)
router.delete('/account', auth.required, [
  body('password').notEmpty().withMessage('비밀번호를 입력해주세요'),
  body('confirmation').equals('DELETE').withMessage('삭제 확인을 위해 "DELETE"를 입력해주세요')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { password } = req.body;

    // AuthService를 사용하여 비밀번호 확인
    const AuthService = require('../services/AuthService');
    const authService = new AuthService();

    // 사용자 정보 조회
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 비밀번호 확인 (bcrypt 사용)
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: '비밀번호가 일치하지 않습니다.'
      });
    }

    // 관련 데이터 삭제 (CASCADE가 설정되어 있지 않은 경우)
    await pool.query('BEGIN');

    try {
      // 사용자 즐겨찾기 삭제
      await pool.query('DELETE FROM user_bookmarks WHERE user_id = $1', [userId]);
      
      // 접속 로그는 통계를 위해 유지하되, 사용자 ID만 NULL로 설정
      await pool.query('UPDATE access_logs SET user_id = NULL WHERE user_id = $1', [userId]);
      
      // 사용자 계정 삭제
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      await pool.query('COMMIT');

      res.json({
        success: true,
        message: '계정이 성공적으로 삭제되었습니다.'
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('계정 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '계정 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 활동 요약
router.get('/activity-summary', auth.required, async (req, res) => {
  try {
    const userId = req.user.id;

    // 최근 7일간 일별 활동
    const activityResult = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as attempts,
        COUNT(CASE WHEN success THEN 1 END) as successes
      FROM access_logs 
      WHERE user_id = $1
        AND created_at > CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [userId]);

    // 주간 통계
    const weeklyStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success THEN 1 END) as successful_attempts,
        COUNT(DISTINCT site_id) as unique_sites,
        AVG(rtt) as avg_rtt
      FROM access_logs 
      WHERE user_id = $1
        AND created_at > CURRENT_DATE - INTERVAL '7 days'
    `, [userId]);

    // 가장 많이 사용한 사이트 (최근 7일)
    const topSiteResult = await pool.query(`
      SELECT 
        s.name,
        s.url,
        COUNT(*) as usage_count
      FROM access_logs al
      JOIN sites s ON al.site_id = s.id
      WHERE al.user_id = $1
        AND al.created_at > CURRENT_DATE - INTERVAL '7 days'
      GROUP BY s.id, s.name, s.url
      ORDER BY usage_count DESC
      LIMIT 1
    `, [userId]);

    const weeklyStats = weeklyStatsResult.rows[0];

    res.json({
      success: true,
      data: {
        weeklyStats: {
          totalAttempts: parseInt(weeklyStats.total_attempts) || 0,
          successfulAttempts: parseInt(weeklyStats.successful_attempts) || 0,
          successRate: weeklyStats.total_attempts > 0 
            ? (parseInt(weeklyStats.successful_attempts) / parseInt(weeklyStats.total_attempts)) * 100 
            : 0,
          uniqueSites: parseInt(weeklyStats.unique_sites) || 0,
          avgRTT: parseFloat(weeklyStats.avg_rtt) || 0
        },
        dailyActivity: activityResult.rows.map(row => ({
          date: row.date,
          attempts: parseInt(row.attempts),
          successes: parseInt(row.successes),
          successRate: parseInt(row.attempts) > 0 
            ? (parseInt(row.successes) / parseInt(row.attempts)) * 100 
            : 0
        })),
        topSite: topSiteResult.rows.length > 0 ? {
          name: topSiteResult.rows[0].name,
          url: topSiteResult.rows[0].url,
          usageCount: parseInt(topSiteResult.rows[0].usage_count)
        } : null
      }
    });

  } catch (error) {
    console.error('활동 요약 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '활동 요약 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 알림 설정 조회
router.get('/notifications', auth.required, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 사용자 기본 알림 설정
    const userResult = await pool.query(`
      SELECT preferences
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const preferences = userResult.rows[0].preferences || {};

    res.json({
      success: true,
      data: {
        global: preferences.notifications || {
          email: true,
          push: true,
          optimalTimeAlerts: true,
          successReports: true
        },
      }
    });

  } catch (error) {
    console.error('알림 설정 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '알림 설정 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 사용자 성과 분석
router.get('/performance', auth.required, [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('기간은 week, month, quarter, year 중 하나여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { period = 'month' } = req.query;

    const periodDays = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365
    };

    const days = periodDays[period];

    // 성과 지표 계산
    const performanceResult = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success THEN 1 END) as successful_attempts,
        AVG(rtt) as avg_rtt,
        AVG(confidence_score) as avg_confidence,
        COUNT(DISTINCT site_id) as unique_sites_used,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM access_logs 
      WHERE user_id = $1
        AND created_at > CURRENT_DATE - INTERVAL '${days} days'
    `, [userId]);

    // 이전 기간과 비교
    const previousResult = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success THEN 1 END) as successful_attempts,
        AVG(rtt) as avg_rtt
      FROM access_logs 
      WHERE user_id = $1
        AND created_at BETWEEN CURRENT_DATE - INTERVAL '${days * 2} days' 
        AND CURRENT_DATE - INTERVAL '${days} days'
    `, [userId]);

    const current = performanceResult.rows[0];
    const previous = previousResult.rows[0];

    // 개선 점수 계산
    const currentSuccessRate = current.total_attempts > 0 
      ? (parseInt(current.successful_attempts) / parseInt(current.total_attempts)) * 100 
      : 0;
    const previousSuccessRate = previous.total_attempts > 0 
      ? (parseInt(previous.successful_attempts) / parseInt(previous.total_attempts)) * 100 
      : 0;

    const improvements = {
      successRate: currentSuccessRate - previousSuccessRate,
      rtt: (parseFloat(previous.avg_rtt) || 0) - (parseFloat(current.avg_rtt) || 0), // RTT는 낮을수록 좋음
      attempts: parseInt(current.total_attempts) - parseInt(previous.total_attempts)
    };

    // 등급 계산
    let grade = 'F';
    if (currentSuccessRate >= 95) grade = 'A+';
    else if (currentSuccessRate >= 90) grade = 'A';
    else if (currentSuccessRate >= 85) grade = 'B+';
    else if (currentSuccessRate >= 80) grade = 'B';
    else if (currentSuccessRate >= 75) grade = 'C+';
    else if (currentSuccessRate >= 70) grade = 'C';
    else if (currentSuccessRate >= 60) grade = 'D';

    res.json({
      success: true,
      data: {
        period,
        grade,
        metrics: {
          totalAttempts: parseInt(current.total_attempts) || 0,
          successfulAttempts: parseInt(current.successful_attempts) || 0,
          successRate: currentSuccessRate,
          avgRTT: parseFloat(current.avg_rtt) || 0,
          avgConfidence: parseFloat(current.avg_confidence) || 0,
          uniqueSites: parseInt(current.unique_sites_used) || 0,
          activeDays: parseInt(current.active_days) || 0
        },
        improvements,
        recommendations: generatePerformanceRecommendations(currentSuccessRate, current.avg_rtt, improvements)
      }
    });

  } catch (error) {
    console.error('성과 분석 실패:', error);
    res.status(500).json({
      success: false,
      message: '성과 분석에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * 성과 개선 권장사항 생성
 */
function generatePerformanceRecommendations(successRate, avgRtt, improvements) {
  const recommendations = [];
  
  if (successRate < 70) {
    recommendations.push('성공률이 낮습니다. 네트워크 연결을 확인하고 최적 오프셋을 조정해보세요.');
  }
  
  if (avgRtt > 500) {
    recommendations.push('네트워크 지연이 높습니다. 더 안정적인 네트워크 환경에서 이용해보세요.');
  }
  
  if (improvements.successRate < -5) {
    recommendations.push('성공률이 하락했습니다. 최근 네트워크 환경 변화를 확인해보세요.');
  }
  
  if (improvements.rtt < -100) {
    recommendations.push('네트워크 지연이 증가했습니다. 네트워크 연결 상태를 점검해보세요.');
  }
  
  if (successRate >= 90) {
    recommendations.push('훌륭한 성과입니다! 현재 설정을 유지하세요.');
  } else if (successRate >= 80) {
    recommendations.push('좋은 성과입니다. 몇 가지 설정을 미세 조정하면 더 개선될 수 있습니다.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('꾸준히 서비스를 이용하고 계시네요. 계속해서 좋은 결과를 얻으시길 바랍니다.');
  }
  
  return recommendations;
}

module.exports = router;