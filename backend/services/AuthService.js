// services/AuthService.js - 인증 서비스
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';
    this.refreshTokenExpiration = process.env.REFRESH_TOKEN_EXPIRATION || '7d';
  }

  /**
   * 사용자 회원가입
   */
  async register(email, password, username, timezone = 'Asia/Seoul') {
    try {
      // 이메일 중복 확인
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('이미 존재하는 이메일입니다');
      }
      
      // 비밀번호 해시화
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // 사용자 생성
      const result = await pool.query(`
        INSERT INTO users (email, password_hash, username, timezone)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, username, timezone, created_at
      `, [email, hashedPassword, username, timezone]);
      
      const user = result.rows[0];
      
      // JWT 토큰 생성
      const tokens = this.generateTokens(user.id);
      
      console.log(`새 사용자 등록: ${email}`);
      
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          timezone: user.timezone,
          createdAt: user.created_at
        },
        ...tokens
      };
      
    } catch (error) {
      console.error('회원가입 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 로그인
   */
  async login(email, password) {
    try {
      // 사용자 조회
      const result = await pool.query(
        'SELECT id, email, password_hash, username, timezone FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) {
        throw new Error('존재하지 않는 이메일입니다');
      }
      
      const user = result.rows[0];
      
      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        throw new Error('잘못된 비밀번호입니다');
      }
      
      // JWT 토큰 생성
      const tokens = this.generateTokens(user.id);
      
      console.log(`사용자 로그인: ${email}`);
      
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          timezone: user.timezone
        },
        ...tokens
      };
      
    } catch (error) {
      console.error('로그인 실패:', error);
      throw error;
    }
  }

  /**
   * JWT 토큰 생성
   */
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: this.jwtExpiration }
    );
    
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiration }
    );
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiration
    };
  }

  /**
   * 리프레시 토큰으로 액세스 토큰 갱신
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('유효하지 않은 리프레시 토큰입니다');
      }
      
      // 사용자 존재 확인
      const userResult = await pool.query(
        'SELECT id FROM users WHERE id = $1',
        [decoded.userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('존재하지 않는 사용자입니다');
      }
      
      // 새 토큰 생성
      const tokens = this.generateTokens(decoded.userId);
      
      return tokens;
      
    } catch (error) {
      console.error('토큰 갱신 실패:', error);
      throw new Error('토큰 갱신에 실패했습니다');
    }
  }

  /**
   * 사용자 프로필 조회
   */
  async getProfile(userId) {
    try {
      const result = await pool.query(`
        SELECT id, email, username, timezone, preferences, created_at, updated_at
        FROM users 
        WHERE id = $1
      `, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('사용자를 찾을 수 없습니다');
      }
      
      return result.rows[0];
      
    } catch (error) {
      console.error('프로필 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 프로필 업데이트
   */
  async updateProfile(userId, updateData) {
    try {
      const allowedFields = ['username', 'timezone', 'preferences'];
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      for (const [field, value] of Object.entries(updateData)) {
        if (allowedFields.includes(field) && value !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }
      
      if (updateFields.length === 0) {
        throw new Error('업데이트할 필드가 없습니다');
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
      
      console.log(`프로필 업데이트: 사용자 ID ${userId}`);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // 현재 비밀번호 확인
      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('사용자를 찾을 수 없습니다');
      }
      
      const user = userResult.rows[0];
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!isValidPassword) {
        throw new Error('현재 비밀번호가 일치하지 않습니다');
      }
      
      // 새 비밀번호 해시화
      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // 비밀번호 업데이트
      await pool.query(`
        UPDATE users 
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [hashedNewPassword, userId]);
      
      console.log(`비밀번호 변경: 사용자 ID ${userId}`);
      
    } catch (error) {
      console.error('비밀번호 변경 실패:', error);
      throw error;
    }
  }

  /**
   * JWT 토큰 검증
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('유효하지 않은 토큰입니다');
    }
  }
}

module.exports = AuthService;