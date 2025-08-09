const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class User {
  constructor(userData = {}) {
    this.id = userData.id;
    this.email = userData.email;
    this.username = userData.username;
    this.name = userData.name;
    this.password = userData.password;
    this.emailVerified = userData.email_verified || false;
    this.notificationSettings = userData.notification_settings || {};
    this.createdAt = userData.created_at;
    this.updatedAt = userData.updated_at;
  }

  /**
   * 사용자 생성
   */
  static async create(userData) {
    const { email, username, name, password } = userData;
    
    // 비밀번호 해싱
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const query = `
      INSERT INTO users (email, username, name, password, notification_settings)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, username, name, email_verified, notification_settings, created_at, updated_at
    `;
    
    const values = [
      email,
      username,
      name,
      hashedPassword,
      JSON.stringify({
        emailNotifications: true,
        pushNotifications: true,
        optimalTimeAlerts: true
      })
    ];
    
    try {
      const result = await pool.query(query, values);
      return new User(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // 중복 키 에러
        if (error.constraint === 'users_email_key') {
          throw new Error('이미 존재하는 이메일입니다');
        }
        if (error.constraint === 'users_username_key') {
          throw new Error('이미 존재하는 사용자명입니다');
        }
      }
      throw error;
    }
  }

  /**
   * 이메일로 사용자 조회
   */
  static async findByEmail(email) {
    const query = `
      SELECT id, email, username, name, password, email_verified, notification_settings, created_at, updated_at
      FROM users
      WHERE email = $1
    `;
    
    const result = await pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  /**
   * 사용자명으로 사용자 조회
   */
  static async findByUsername(username) {
    const query = `
      SELECT id, email, username, name, password, email_verified, notification_settings, created_at, updated_at
      FROM users
      WHERE username = $1
    `;
    
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  /**
   * ID로 사용자 조회
   */
  static async findById(id) {
    const query = `
      SELECT id, email, username, name, password, email_verified, notification_settings, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  /**
   * 비밀번호 검증
   */
  async validatePassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  /**
   * 사용자 정보 업데이트
   */
  async update(updateData) {
    const allowedFields = ['username', 'name', 'notification_settings'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'notification_settings') {
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
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, username, name, email_verified, notification_settings, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    // 현재 인스턴스 업데이트
    const updatedUser = result.rows[0];
    Object.assign(this, updatedUser);

    return this;
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(currentPassword, newPassword) {
    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await this.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('현재 비밀번호가 올바르지 않습니다');
    }

    // 새 비밀번호 해싱
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    const query = `
      UPDATE users
      SET password = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await pool.query(query, [hashedNewPassword, this.id]);
    
    return true;
  }

  /**
   * 이메일 인증 상태 업데이트
   */
  async verifyEmail() {
    const query = `
      UPDATE users
      SET email_verified = true, updated_at = NOW()
      WHERE id = $1
    `;

    await pool.query(query, [this.id]);
    this.emailVerified = true;
    
    return true;
  }


  /**
   * 사용자 접속 기록 조회
   */
  async getAccessHistory(limit = 50) {
    const query = `
      SELECT al.*, s.name as site_name, s.url as site_url
      FROM access_logs al
      JOIN sites s ON al.site_id = s.id
      WHERE al.user_id = $1
      ORDER BY al.access_time DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [this.id, limit]);
    return result.rows;
  }

  /**
   * 사용자 성공률 통계
   */
  async getSuccessStats() {
    const query = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_attempts,
        ROUND(
          COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*), 2
        ) as success_rate,
        AVG(CASE WHEN success = true THEN response_time END) as avg_response_time
      FROM access_logs
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [this.id]);
    return result.rows[0];
  }

  /**
   * 사용자 삭제
   */
  async delete() {
    const query = `DELETE FROM users WHERE id = $1`;
    const result = await pool.query(query, [this.id]);
    return result.rowCount > 0;
  }

  /**
   * 비밀번호 제외하고 안전한 정보만 반환
   */
  toSafeObject() {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      name: this.name,
      emailVerified: this.emailVerified,
      notificationSettings: this.notificationSettings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;