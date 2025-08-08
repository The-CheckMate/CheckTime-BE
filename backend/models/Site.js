const { Pool } = require('pg');
const { isValidUrl } = require('../utils/validators');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class Site {
  constructor(siteData = {}) {
    this.id = siteData.id;
    this.url = siteData.url;
    this.name = siteData.name;
    this.category = siteData.category;
    this.description = siteData.description;
    this.optimalOffset = siteData.optimal_offset || 2500; // 기본 2.5초
    this.keywords = siteData.keywords || [];
    this.isActive = siteData.is_active !== false;
    this.avgResponseTime = siteData.avg_response_time;
    this.successRate = siteData.success_rate;
    this.createdAt = siteData.created_at;
    this.updatedAt = siteData.updated_at;
  }

  /**
   * 사이트 생성
   */
  static async create(siteData) {
    const { url, name, category, description, optimalOffset = 2500, keywords = [] } = siteData;
    
    // URL 유효성 검증
    if (!isValidUrl(url)) {
      throw new Error('유효하지 않은 URL입니다');
    }

    const query = `
      INSERT INTO sites (url, name, category, description, optimal_offset, keywords)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [url, name, category, description, optimalOffset, JSON.stringify(keywords)];
    
    try {
      const result = await pool.query(query, values);
      return new Site(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // 중복 키 에러
        throw new Error('이미 등록된 사이트입니다');
      }
      throw error;
    }
  }

  /**
   * 모든 사이트 조회
   */
  static async findAll(options = {}) {
    const { category, isActive = true, limit = 100, offset = 0 } = options;
    
    let query = `
      SELECT s.*, 
             COALESCE(AVG(al.response_time), 0) as avg_response_time,
             COALESCE(
               SUM(CASE WHEN al.success = true THEN 1 ELSE 0 END) * 100.0 / 
               NULLIF(COUNT(al.id), 0), 0
             ) as success_rate
      FROM sites s
      LEFT JOIN access_logs al ON s.id = al.site_id
      WHERE s.is_active = $1
    `;
    
    const values = [isActive];
    let paramCount = 2;

    if (category) {
      query += ` AND s.category = $${paramCount}`;
      values.push(category);
      paramCount++;
    }

    query += `
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(row => new Site(row));
  }

  /**
   * ID로 사이트 조회
   */
  static async findById(id) {
    const query = `
      SELECT s.*, 
             COALESCE(AVG(al.response_time), 0) as avg_response_time,
             COALESCE(
               SUM(CASE WHEN al.success = true THEN 1 ELSE 0 END) * 100.0 / 
               NULLIF(COUNT(al.id), 0), 0
             ) as success_rate
      FROM sites s
      LEFT JOIN access_logs al ON s.id = al.site_id
      WHERE s.id = $1
      GROUP BY s.id
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Site(result.rows[0]);
  }

  /**
   * URL로 사이트 조회
   */
  static async findByUrl(url) {
    const query = `
      SELECT s.*, 
             COALESCE(AVG(al.response_time), 0) as avg_response_time,
             COALESCE(
               SUM(CASE WHEN al.success = true THEN 1 ELSE 0 END) * 100.0 / 
               NULLIF(COUNT(al.id), 0), 0
             ) as success_rate
      FROM sites s
      LEFT JOIN access_logs al ON s.id = al.site_id
      WHERE s.url = $1
      GROUP BY s.id
    `;
    
    const result = await pool.query(query, [url]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Site(result.rows[0]);
  }

  /**
   * 사이트 검색
   */
  static async search(query, options = {}) {
    const { category, limit = 20 } = options;
    
    let searchQuery = `
      SELECT s.*, 
             COALESCE(AVG(al.response_time), 0) as avg_response_time,
             COALESCE(
               SUM(CASE WHEN al.success = true THEN 1 ELSE 0 END) * 100.0 / 
               NULLIF(COUNT(al.id), 0), 0
             ) as success_rate,
             CASE 
               WHEN s.name ILIKE $1 THEN 3
               WHEN s.url ILIKE $1 THEN 2
               WHEN s.keywords::text ILIKE $1 THEN 1
               ELSE 0
             END as relevance
      FROM sites s
      LEFT JOIN access_logs al ON s.id = al.site_id
      WHERE s.is_active = true
      AND (
        s.name ILIKE $1 OR 
        s.url ILIKE $1 OR 
        s.keywords::text ILIKE $1 OR
        s.description ILIKE $1
      )
    `;
    
    const values = [`%${query}%`];
    let paramCount = 2;

    if (category) {
      searchQuery += ` AND s.category = $${paramCount}`;
      values.push(category);
      paramCount++;
    }

    searchQuery += `
      GROUP BY s.id
      ORDER BY relevance DESC, s.created_at DESC
      LIMIT $${paramCount}
    `;
    
    values.push(limit);

    const result = await pool.query(searchQuery, values);
    return result.rows.map(row => new Site(row));
  }

  /**
   * 인기 사이트 조회
   */
  static async getPopularSites(limit = 10) {
    const query = `
      SELECT s.*, 
             COUNT(al.id) as access_count,
             COALESCE(AVG(al.response_time), 0) as avg_response_time,
             COALESCE(
               SUM(CASE WHEN al.success = true THEN 1 ELSE 0 END) * 100.0 / 
               NULLIF(COUNT(al.id), 0), 0
             ) as success_rate
      FROM sites s
      LEFT JOIN access_logs al ON s.id = al.site_id
      WHERE s.is_active = true
      AND al.access_time > NOW() - INTERVAL '30 days'
      GROUP BY s.id
      ORDER BY access_count DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows.map(row => new Site(row));
  }

  /**
   * 카테고리별 사이트 수 조회
   */
  static async getCategoryStats() {
    const query = `
      SELECT category, COUNT(*) as count
      FROM sites
      WHERE is_active = true
      GROUP BY category
      ORDER BY count DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * 사이트 정보 업데이트
   */
  async update(updateData) {
    const allowedFields = ['name', 'category', 'description', 'optimal_offset', 'keywords'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'keywords') {
          updates.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new Error('업데이트할 필드가 없습니다');
    }

    updates.push(`updated_at = NOW()`);
    values.push(this.id);

    const query = `
      UPDATE sites
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('사이트를 찾을 수 없습니다');
    }

    // 현재 인스턴스 업데이트
    Object.assign(this, result.rows[0]);
    return this;
  }

  /**
   * 사이트 활성/비활성 상태 변경
   */
  async toggleActive() {
    const query = `
      UPDATE sites
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING is_active
    `;

    const result = await pool.query(query, [this.id]);
    this.isActive = result.rows[0].is_active;
    
    return this.isActive;
  }

  /**
   * 사이트 삭제 (소프트 삭제)
   */
  async delete() {
    const query = `
      UPDATE sites
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;

    const result = await pool.query(query, [this.id]);
    this.isActive = false;
    
    return result.rowCount > 0;
  }

  /**
   * 사이트 접속 기록 추가
   */
  async addAccessLog(userId, success, responseTime, rtt = null) {
    const query = `
      INSERT INTO access_logs (user_id, site_id, success, response_time, rtt, access_time)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [userId, this.id, success, responseTime, rtt]);
    return result.rows[0];
  }

  /**
   * 사이트 최적 오프셋 자동 업데이트
   */
  async updateOptimalOffset() {
    const query = `
      SELECT AVG(response_time) as avg_response,
             COUNT(CASE WHEN success = true THEN 1 END) as success_count,
             COUNT(*) as total_count
      FROM access_logs
      WHERE site_id = $1
      AND access_time > NOW() - INTERVAL '7 days'
    `;

    const result = await pool.query(query, [this.id]);
    const stats = result.rows[0];

    if (stats.total_count >= 10) { // 최소 10개의 데이터가 있을 때만 업데이트
      const successRate = stats.success_count / stats.total_count;
      const avgResponse = parseFloat(stats.avg_response) || 0;
      
      // 성공률과 평균 응답시간을 고려한 최적 오프셋 계산
      let newOptimalOffset = Math.max(avgResponse * 1.2, 1000); // 최소 1초
      
      if (successRate < 0.7) {
        newOptimalOffset *= 1.5; // 성공률이 낮으면 오프셋 증가
      }
      
      newOptimalOffset = Math.min(newOptimalOffset, 10000); // 최대 10초

      const updateQuery = `
        UPDATE sites
        SET optimal_offset = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING optimal_offset
      `;

      const updateResult = await pool.query(updateQuery, [Math.round(newOptimalOffset), this.id]);
      this.optimalOffset = updateResult.rows[0].optimal_offset;
    }

    return this.optimalOffset;
  }

  /**
   * 사이트 통계 조회
   */
  async getStats(days = 30) {
    const query = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_attempts,
        ROUND(
          COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as success_rate,
        AVG(response_time) as avg_response_time,
        MIN(response_time) as min_response_time,
        MAX(response_time) as max_response_time,
        DATE_TRUNC('day', access_time) as date,
        COUNT(*) as daily_attempts
      FROM access_logs
      WHERE site_id = $1
      AND access_time > NOW() - INTERVAL '${days} days'
      GROUP BY DATE_TRUNC('day', access_time)
      ORDER BY date DESC
    `;

    const result = await pool.query(query, [this.id]);
    return result.rows;
  }

  /**
   * 사이트 정보를 객체로 반환
   */
  toObject() {
    return {
      id: this.id,
      url: this.url,
      name: this.name,
      category: this.category,
      description: this.description,
      optimalOffset: this.optimalOffset,
      keywords: this.keywords,
      isActive: this.isActive,
      avgResponseTime: this.avgResponseTime,
      successRate: this.successRate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Site;