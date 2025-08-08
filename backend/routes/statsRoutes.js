// 통계 관련 API 라우트
const express = require('express');
const auth = require('../middlewares/auth');
const { query, validationResult } = require('express-validator');
const { Pool } = require('pg');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 사용자별 성공률 통계
router.get('/success-rate', auth.required, [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('일수는 1-365 사이여야 합니다'),
  query('siteId').optional().isInt().withMessage('사이트 ID는 정수여야 합니다')
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
    const { days = 30, siteId } = req.query;
    
    let query = `
      SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_attempts,
        AVG(rtt) as avg_rtt,
        AVG(confidence_score) as avg_confidence
      FROM access_logs 
      WHERE user_id = $1 
        AND created_at > CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    `;
    
    const params = [userId];
    
    if (siteId) {
      query += ' AND site_id = $2';
      params.push(siteId);
    }
    
    const result = await pool.query(query, params);
    const data = result.rows[0];
    
    const stats = {
      totalAttempts: parseInt(data.total_attempts) || 0,
      successfulAttempts: parseInt(data.successful_attempts) || 0,
      successRate: data.total_attempts > 0 
        ? (parseInt(data.successful_attempts) / parseInt(data.total_attempts)) * 100 
        : 0,
      avgRTT: parseFloat(data.avg_rtt) || 0,
      avgConfidence: parseFloat(data.avg_confidence) || 0,
      period: `${days} days`
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 사용자별 접속 기록
router.get('/history', auth.required, [
  query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('제한은 1-100 사이여야 합니다'),
  query('siteId').optional().isInt().withMessage('사이트 ID는 정수여야 합니다')
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
    const { page = 1, limit = 20, siteId } = req.query;
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
      query += ` AND al.site_id = ${paramIndex}`;
      params.push(siteId);
      paramIndex++;
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) FROM access_logs WHERE user_id = $1';
    const countParams = [userId];
    
    if (siteId) {
      countQuery += ' AND site_id = $2';
      countParams.push(siteId);
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 전체 시스템 통계 (관리자용)
router.get('/system', async (req, res) => {
  try {
    const [
      userStats,
      siteStats,
      accessStats,
      networkStats
    ] = await Promise.all([
      // 사용자 통계
      pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week
        FROM users
      `),
      
      // 사이트 통계
      pool.query(`
        SELECT 
          COUNT(*) as total_sites,
          COUNT(CASE WHEN is_active THEN 1 END) as active_sites,
          AVG(success_rate) as avg_success_rate
        FROM sites
      `),
      
      // 접속 통계
      pool.query(`
        SELECT 
          COUNT(*) as total_attempts,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_attempts,
          COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as attempts_24h
        FROM access_logs
      `),
      
      // 네트워크 성능 통계
      pool.query(`
        SELECT 
          AVG(average_rtt) as system_avg_rtt,
          COUNT(*) as total_measurements
        FROM network_performance_logs
        WHERE measured_at > CURRENT_DATE - INTERVAL '7 days'
      `)
    ]);
    
    const stats = {
      users: userStats.rows[0],
      sites: siteStats.rows[0],
      access: accessStats.rows[0],
      network: networkStats.rows[0],
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;