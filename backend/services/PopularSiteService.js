// PopularSiteService.js
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

class PopularSiteService {
    constructor() {}

    /**
     * 링크 클릭 이벤트를 기록
     * @param {number} siteId - 클릭된 사이트의 ID
     * @param {string} category - 사이트의 카테고리 (e.g., 'general', '대학', '티켓팅')
     */
    async logClick(siteId, category) {
        try {
            await pool.query(
                `INSERT INTO popular_site_clicks (site_id, category) VALUES ($1, $2)`,
                [siteId, category]
            );
        } catch (error) {
            console.error('클릭 로그 기록 실패:', error);
            // 로그 기록 실패는 치명적인 오류가 아니므로, 에러를 던지지 않고 경고만 표시
        }
    }

    /**
     * 인기 링크 목록을 조회
     * @param {string} periodType - 'daily', 'weekly', 'realtime'
     * @param {string} category - 조회할 카테고리 (null이면 전체)
     * @param {number} limit - 가져올 순위 수
     * @returns {Promise<Array>} 인기 사이트 목록
     */
    async getPopularSites(periodType, category = null, limit = 5) {
        try {
            let interval;
            // 기간 타입에 따른 시간 간격 설정
            switch (periodType) {
                case 'weekly':
                    interval = `date_trunc('week', NOW())`;
                    break;
                case 'daily':
                    interval = `date_trunc('day', NOW())`;
                    break;
                case 'realtime':
                    interval = `NOW() - INTERVAL '2 hours'`; // 2시간 이내
                    break;
                default:
                    // 전체 기간(All-time)
                    return this.getOverallPopularSites(category, limit);
            }

            // 공통 쿼리 구성
            let query = `
                SELECT
                    p.site_id,
                    s.url,
                    s.name,
                    s.category,
                    COUNT(p.site_id) AS click_count
                FROM
                    popular_site_clicks p
                JOIN
                    sites s ON p.site_id = s.id
                WHERE
                    p.clicked_at > ${interval}
                    AND s.is_active = true
            `;

            const params = [];
            let paramIndex = 1;

            if (category) {
                query += ` AND p.category = $${paramIndex}`;
                params.push(category);
                paramIndex++;
            }

            query += `
                GROUP BY
                    p.site_id, s.url, s.name, s.category
                ORDER BY
                    click_count DESC
                LIMIT $${paramIndex}
            `;
            params.push(limit);
            
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('인기 사이트 조회 실패:', error);
            throw new Error('인기 사이트를 불러올 수 없습니다');
        }
    }

    /**
     * 전체 기간 인기 링크를 조회
     * @param {string} category - 조회할 카테고리 (null이면 전체)
     * @param {number} limit - 가져올 순위 수
     * @returns {Promise<Array>} 전체 기간 인기 사이트 목록
     */
    async getOverallPopularSites(category = null, limit = 10) {
        try {
            let query = `
                SELECT
                    id, url, name, category, usage_count as click_count
                FROM
                    sites
                WHERE
                    is_active = true
            `;
            const params = [];
            let paramIndex = 1;

            if (category) {
                query += ` AND category = $${paramIndex}`;
                params.push(category);
                paramIndex++;
            }

            query += `
                ORDER BY
                    usage_count DESC
                LIMIT $${paramIndex}
            `;
            params.push(limit);

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('전체 인기 사이트 조회 실패:', error);
            throw new Error('전체 인기 사이트를 불러올 수 없습니다');
        }
    }
}

module.exports = new PopularSiteService();
