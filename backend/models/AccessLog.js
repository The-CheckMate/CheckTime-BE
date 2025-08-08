const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class AccessLog {
  constructor(logData = {}) {
    this.id = logData.id;
    this.userId = logData.user_id;
    this.siteId = logData.site_id;
    this.success = logData.success;
    this.responseTime = logData.response_time;
    this.rtt = logData.rtt;
    this.accessTime = logData.access_time;
    this.errorMessage = logData.error_message;
    this.userAgent = logData.user_agent;
    this.ipAddress = logData.ip_address;
  }

  /**
   * 접속 로그 생성
   */
  static async create(logData) {
    const {
      userId,
      siteId,
      success,
      responseTime,
      rtt = null,
      errorMessage = null,
      userAgent = null,
      ipAddress = null
    } = logData;

    const query = `
      INSERT INTO access_logs (
        user_id, site_id, success, response_time, rtt, 
        error_message, user_agent, ip_address, access_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const values = [
      userId,
      siteId,
      success,
      responseTime,
      rtt,
      errorMessage,
      userAgent,
      ipAddress
    ];

    const result = await pool.query(query, values);
    return new AccessLog(result.rows[0]);
  }

  /**
   * 사용자별 접속 로그 조회
   */
  static async findByUser(userId, options = {}) {
    const { limit = 50, offset = 0, siteId = null, success = null } = options;

    let query = `
      SELECT al.*, s.name as site_name, s.url as site_url
      FROM access_logs al
      JOIN sites s ON al.site_id = s.id
      WHERE al.user_id = $1
    `;

    const values = [userId];
    let paramCount = 2;

    if (siteId) {
      query += ` AND al.site_id = $${paramCount}`;
      values.push(siteId);
      paramCount++;
    }

    if (success !== null) {
      query += ` AND al.success = $${paramCount}`;
      values.push(success);
      paramCount++;
    }

    query += `
      ORDER BY al.access_time DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(row => new AccessLog(row));
  }

  /**
   * 사이트별 접속 로그 조회
   */
  static async findBySite(siteId, options = {}) {
    const { limit = 50, offset = 0, success = null, days = 30 } = options;

    let query = `
      SELECT al.*, u.username, u.email
      FROM access_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.site_id = $1
      AND al.access_time > NOW() - INTERVAL '${days} days'
    `;

    const values = [siteId];
    let paramCount = 2;

    if (success !== null) {
      query += ` AND al.success = $${paramCount}`;
      values.push(success);
      paramCount++;
    }

    query += `
      ORDER BY al.access_time DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(row => new AccessLog(row));
  }

  /**
   * 전체 성공률 통계
   */
  static async getSuccessStats(options = {}) {
    const { days = 30, siteId = null, userId = null } = options;

    let query = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_attempts,
        ROUND(
          COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as success_rate,
        AVG(response_time) as avg_response_time,
        MIN(response_time) as min_response_time,
        MAX(response_time) as max_response_time
      FROM access_logs
      WHERE access_time > NOW() - INTERVAL '${days} days'
    `;

    const values = [];
    let paramCount = 1;

    if (siteId) {
      query += ` AND site_id = $${paramCount}`;
      values.push(siteId);
      paramCount++;
    }

    if (userId) {
      query += ` AND user_id = $${paramCount}`;
      values.push(userId);
      paramCount++;
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * 시간대별 접속 통계
   */
  static async getHourlyStats(options = {}) {
    const { days = 7, siteId = null } = options;

    let query = `
      SELECT 
        EXTRACT(HOUR FROM access_time) as hour,
        COUNT(*) as attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successes,
        ROUND(
          COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as success_rate,
        AVG(response_time) as avg_response_time
      FROM access_logs
      WHERE access_time > NOW() - INTERVAL '${days} days'
    `;

    const values = [];
    let paramCount = 1;

    if (siteId) {
      query += ` AND site_id = $${paramCount}`;
      values.push(siteId);
      paramCount++;
    }

    query += `
      GROUP BY EXTRACT(HOUR FROM access_time)
      ORDER BY hour
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * 일별 접속 통계
   */
  static async getDailyStats(options = {}) {
    const { days = 30, siteId = null, userId = null } = options;

    let query = `
      SELECT 
        DATE_TRUNC('day', access_time) as date,
        COUNT(*) as attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successes,
        ROUND(
          COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as success_rate,
        AVG(response_time) as avg_response_time
      FROM access_logs
      WHERE access_time > NOW() - INTERVAL '${days} days'
    `;

    const values = [];
    let paramCount = 1;

    if (siteId) {
      query += ` AND site_id = $${paramCount}`;
      values.push(siteId);
      paramCount++;
    }

    if (userId) {
      query += ` AND user_id = $${paramCount}`;
      values.push(userId);
      paramCount++;
    }

    query += `
      GROUP BY DATE_TRUNC('day', access_time)
      ORDER BY date DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * 최근 접속 시도 조회
   */
  static async getRecentAttempts(limit = 20) {
    const query = `
      SELECT al.*, s.name as site_name, s.url as site_url, u.username
      FROM access_logs al
      JOIN sites s ON al.site_id = s.id
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.access_time DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows.map(row => new AccessLog(row));
  }

  /**
   * 실패한 접속 시도 조회
   */
  static async getFailedAttempts(options = {}) {
    const { limit = 50, days = 7, siteId = null, userId = null } = options;

    let query = `
      SELECT al.*, s.name as site_name, s.url as site_url, u.username
      FROM access_logs al
      JOIN sites s ON al.site_id = s.id
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.success = false
      AND al.access_time > NOW() - INTERVAL '${days} days'
    `;

    const values = [];
    let paramCount = 1;

    if (siteId) {
      query += ` AND al.site_id = $${paramCount}`;
      values.push(siteId);
      paramCount++;
    }

    if (userId) {
      query += ` AND al.user_id = $${paramCount}`;
      values.push(userId);
      paramCount++;
    }

    query += `
      ORDER BY al.access_time DESC
      LIMIT $${paramCount}
    `;

    values.push(limit);

    const result = await pool.query(query, values);
    return result.rows.map(row => new AccessLog(row));
  }

  /**
   * 응답 시간 분석
   */
  static async analyzeResponseTimes(options = {}) {
    const { days = 30, siteId = null } = options;

    let query = `
      SELECT 
        AVG(response_time) as avg_response_time,
        MIN(response_time) as min_response_time,
        MAX(response_time) as max_response_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time) as median_response_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99_response_time,
        COUNT(*) as sample_count
      FROM access_logs
      WHERE access_time > NOW() - INTERVAL '${days} days'
      AND success = true
    `;

    const values = [];
    let paramCount = 1;

    if (siteId) {
      query += ` AND site_id = $${paramCount}`;
      values.push(siteId);
      paramCount++;
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * 로그 정리 (오래된 로그 삭제)
   */
  static async cleanup(daysToKeep = 90) {
    const query = `
      DELETE FROM access_logs
      WHERE access_time < NOW() - INTERVAL '${daysToKeep} days'
    `;

    const result = await pool.query(query);
    return result.rowCount;
  }

  /**
   * 객체 변환
   */
  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      siteId: this.siteId,
      success: this.success,
      responseTime: this.responseTime,
      rtt: this.rtt,
      accessTime: this.accessTime,
      errorMessage: this.errorMessage,
      userAgent: this.userAgent,
      ipAddress: this.ipAddress
    };
  }
}

module.exports = AccessLog;