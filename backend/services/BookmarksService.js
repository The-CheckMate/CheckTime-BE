const { Pool } = require('pg');
const fetch = require('node-fetch').default;    // favicon 검사용
const { URL } = require('url');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class BookmarksService {
  // 목록 조회
  async list(userId) {
    const res = await pool.query(
      `SELECT id, custom_name, custom_url, favicon, created_at
       FROM user_bookmarks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows;
  }

  // 추가
  async add(userId, custom_name, custom_url, favicon) {
    // 로그인 유효성: userId는 라우터 미들웨어에서 보장됨

    // 최대 10개 검사
    const countRes = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM user_bookmarks
       WHERE user_id = $1`,
      [userId]
    );
    if (parseInt(countRes.rows[0].cnt) >= 10) {
      throw new Error('북마크는 최대 10개까지 저장할 수 있습니다');
    }

    // 중복 URL 검사
    const dupRes = await pool.query(
      `SELECT 1 FROM user_bookmarks WHERE user_id = $1 AND custom_url = $2`,
      [userId, custom_url]
    );
    if (dupRes.rows.length) {
      throw new Error('이미 저장된 URL입니다');
    }

    // 1) 레코드 삽입 (favicon 칼럼은 일단 NULL로)
    const insertRes = await pool.query(
      `INSERT INTO user_bookmarks (user_id, custom_name, custom_url, favicon)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, custom_name, custom_url, favicon || null]
    );
    const bookmarkId = insertRes.rows[0].id;

    //console.log(`[add] 추가된 북마크 ID: ${bookmarkId}`);

    // 2) favicon 자동 탐색
    const autoFavicon = await this.fetchFaviconUrl(custom_url);
    //console.log(`[add] autoFavicon: ${autoFavicon}`);
    if (autoFavicon) {
      await pool.query(
        `UPDATE user_bookmarks
           SET favicon = $1
         WHERE id = $2`,
        [autoFavicon, bookmarkId]
      );
    }

    // 3) 최종 레코드 조회 및 반환
    const finalRes = await pool.query(
      `SELECT id, custom_name, custom_url, favicon, created_at
         FROM user_bookmarks
        WHERE id = $1`,
      [bookmarkId]
    );

    return finalRes.rows[0];
  }

  // 삭제
  async remove(userId, bookmarkId) {
    const delRes = await pool.query(
      `DELETE FROM user_bookmarks
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, bookmarkId]
    );
    if (!delRes.rows.length) {
      throw new Error('삭제할 북마크를 찾을 수 없습니다');
    }
    return delRes.rows[0];
  }

  // 수정
  async update(userId, bookmarkId, custom_name, custom_url, favicon) {
    // URL 중복 검사 (다른 레코드와)
    const dupRes = await pool.query(
      `SELECT 1 FROM user_bookmarks
       WHERE user_id = $1 AND custom_url = $2 AND id <> $3`,
      [userId, custom_url, bookmarkId]
    );
    if (dupRes.rows.length) {
      throw new Error('다른 북마크와 URL이 중복됩니다');
    }

    const fields = [];
    const vals   = [];
    let idx = 1;

    if (custom_name !== undefined) {
      fields.push(`custom_name = $${idx++}`);
      vals.push(custom_name);
    }
    if (custom_url !== undefined) {
      fields.push(`custom_url = $${idx++}`);
      vals.push(custom_url);
    }
    if (favicon !== undefined) {
      fields.push(`favicon = $${idx++}`);
      vals.push(favicon);
    }
    if (!fields.length) {
      throw new Error('수정할 필드를 지정하세요');
    }

    vals.push(userId, bookmarkId);
    const q = `
      UPDATE user_bookmarks
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${idx++} AND id = $${idx}
      RETURNING *`;
    const res = await pool.query(q, vals);
    if (!res.rows.length) {
      throw new Error('수정할 북마크를 찾을 수 없습니다');
    }
    return res.rows[0];
  }

  async getUrlById(userId, bookmarkId) {
    const res = await pool.query(
      `SELECT custom_url 
         FROM user_bookmarks 
        WHERE id = $1 AND user_id = $2`,
      [bookmarkId, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('해당 북마크를 찾을 수 없습니다');
    }
    return res.rows[0].custom_url;
  }

  // 파비콘 업데이트 (옵션): URL에서 파비콘 크롤링 후 저장
  async saveFavicon(bookmarkId, faviconUrl) {
    await pool.query(
      `UPDATE user_bookmarks
       SET favicon = $1
       WHERE id = $2`,
      [faviconUrl, bookmarkId]
    );
  }

  // favicon 검사 후 URL 반환
  async fetchFaviconUrl(pageUrl) {
    try {
      const { origin } = new URL(pageUrl);
      const faviconUrl = `${origin}/favicon.ico`;
      //console.log(`[fetchFavicon] favicon URL 생성: faviconUrl=${faviconUrl}`);

      const res = await fetch(faviconUrl, { method: 'HEAD' });
      //console.log(`[fetchFavicon] HTTP 상태 코드: ${res.status}, res.ok=${res.ok}`);
      
      const contentType = res.headers.get('content-type') || '';
      //console.log(`[fetchFavicon] Content-Type 확인: ${contentType}`);

      if (res.ok && contentType.includes('image/')) {
        return faviconUrl;
      }
    } catch(err) {
      console.error(`[fetchFavicon] 예외 발생: ${err.message}`);
      // 무시하고 null 반환
    }
    return null;
  }

}

module.exports = BookmarksService;