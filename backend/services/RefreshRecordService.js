const db = require('../config/database');

class RefreshRecordService {
  /**
   * 반응속도 기록 저장/업데이트 (히스토리 포함)
   */
  async saveRefreshRecord(userId, siteId, refreshTime) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 히스토리 테이블에 개별 기록 저장 (선택사항)
      // refresh_time_history 테이블이 있는 경우만 사용
      try {
        await client.query(
          `INSERT INTO refresh_time_history (user_id, site_id, refresh_time)
           VALUES ($1, $2, $3)`,
          [userId, siteId, refreshTime]
        );
      } catch (err) {
        // 테이블이 없으면 무시
        console.log('History table not available, skipping...');
      }

      // 2. 통계 계산
      const statsQuery = await client.query(
        `SELECT 
           MIN(refresh_time) as best_time,
           AVG(refresh_time) as avg_time,
           COUNT(*) as total_count
         FROM refresh_time_history
         WHERE user_id = $1 AND site_id = $2`,
        [userId, siteId]
      );

      let bestTime, avgTime;
      
      if (statsQuery.rows.length > 0 && statsQuery.rows[0].total_count > 0) {
        // 히스토리 테이블이 있으면 정확한 통계 사용
        bestTime = parseFloat(statsQuery.rows[0].best_time);
        avgTime = parseFloat(statsQuery.rows[0].avg_time);
      } else {
        // 히스토리 테이블이 없으면 기존 방식 사용
        const existingRecord = await client.query(
          `SELECT user_best_time, user_average_time 
           FROM user_refresh_records 
           WHERE user_id = $1 AND site_id = $2`,
          [userId, siteId]
        );

        if (existingRecord.rows.length > 0) {
          const current = existingRecord.rows[0];
          bestTime = Math.min(current.user_best_time || refreshTime, refreshTime);
          avgTime = current.user_average_time 
            ? (current.user_average_time + refreshTime) / 2 
            : refreshTime;
        } else {
          bestTime = refreshTime;
          avgTime = refreshTime;
        }
      }

      // 3. user_refresh_records 업데이트 또는 삽입
      const upsertResult = await client.query(
        `INSERT INTO user_refresh_records 
         (user_id, site_id, refresh_time, user_best_time, user_average_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, site_id) 
         DO UPDATE SET 
           refresh_time = $3,
           user_best_time = $4,
           user_average_time = $5,
           created_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, siteId, refreshTime, bestTime, avgTime]
      );

      await client.query('COMMIT');

      return {
        success: true,
        record: upsertResult.rows[0],
        isNewBest: refreshTime === bestTime
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving refresh record:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 사이트별 순위 조회
   */
  async getSiteRankings(siteId, rankType = 'best', limit = 100) {
    try {
      const orderColumn = rankType === 'best' ? 'user_best_time' : 'user_average_time';
      const rankColumn = rankType === 'best' ? 'best_rank' : 'avg_rank';

      const result = await db.query(
        `SELECT 
           user_id,
           username,
           user_best_time,
           user_average_time,
           ${rankColumn} as rank,
           last_updated
         FROM refresh_rankings
         WHERE site_id = $1
         ORDER BY ${rankColumn} ASC
         LIMIT $2`,
        [siteId, limit]
      );

      return {
        success: true,
        rankings: result.rows
      };
    } catch (error) {
      console.error('Error getting site rankings:', error);
      throw error;
    }
  }

  /**
   * 사용자의 순위 조회
   */
  async getUserRank(userId, siteId) {
    try {
      const result = await db.query(
        `SELECT 
           user_id,
           username,
           user_best_time,
           user_average_time,
           best_rank,
           avg_rank,
           last_updated
         FROM refresh_rankings
         WHERE user_id = $1 AND site_id = $2`,
        [userId, siteId]
      );

      if (result.rows.length === 0) {
        return {
          success: true,
          rank: null,
          message: '아직 기록이 없습니다'
        };
      }

      return {
        success: true,
        rank: result.rows[0]
      };
    } catch (error) {
      console.error('Error getting user rank:', error);
      throw error;
    }
  }

  /**
   * 사용자 주변 순위 조회
   */
  async getNearbyRankings(userId, siteId, range = 5) {
    try {
      const userRank = await this.getUserRank(userId, siteId);
      
      if (!userRank.rank) {
        return {
          success: true,
          rankings: [],
          userRank: null
        };
      }

      const myRank = userRank.rank.best_rank;

      const result = await db.query(
        `SELECT 
           user_id,
           username,
           user_best_time,
           user_average_time,
           best_rank,
           avg_rank
         FROM refresh_rankings
         WHERE site_id = $1 
           AND best_rank BETWEEN $2 AND $3
         ORDER BY best_rank ASC`,
        [siteId, Math.max(1, myRank - range), myRank + range]
      );

      return {
        success: true,
        rankings: result.rows,
        userRank: userRank.rank
      };
    } catch (error) {
      console.error('Error getting nearby rankings:', error);
      throw error;
    }
  }

  /**
   * 사용자의 기록 히스토리 조회 (최근 N개)
   */
  async getUserHistory(userId, siteId, limit = 50) {
    try {
      const result = await db.query(
        `SELECT 
           refresh_time,
           created_at
         FROM refresh_time_history
         WHERE user_id = $1 AND site_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, siteId, limit]
      );

      return {
        success: true,
        history: result.rows
      };
    } catch (error) {
      // 히스토리 테이블이 없는 경우
      console.log('History table not available');
      return {
        success: true,
        history: []
      };
    }
  }
}

module.exports = RefreshRecordService;