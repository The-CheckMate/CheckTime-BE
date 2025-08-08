const express = require('express');
const { Pool } = require('pg');
const auth = require('../middlewares/auth');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 링크(사이트) 목록 조회
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('제한은 1-100 사이여야 합니다'),
  query('category').optional().isString().withMessage('카테고리는 문자열이어야 합니다'),
  query('search').optional().isString().withMessage('검색어는 문자열이어야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20, category, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        id, url, name, category, description, optimal_offset,
        keywords, usage_count, average_rtt, success_rate,
        created_at, updated_at
      FROM sites 
      WHERE is_active = true
    `;
    const params = [];
    let paramIndex = 1;

    // 카테고리 필터
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // 검색 필터
    if (search) {
      query += ` AND (
        name ILIKE $${paramIndex} OR 
        url ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex} OR
        $${paramIndex} = ANY(keywords)
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // 정렬 및 페이징
    query += ` ORDER BY usage_count DESC, created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) FROM sites WHERE is_active = true';
    const countParams = [];
    let countParamIndex = 1;

    if (category) {
      countQuery += ` AND category = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (
        name ILIKE $${countParamIndex} OR 
        url ILIKE $${countParamIndex} OR 
        description ILIKE $${countParamIndex} OR
        $${countParamIndex} = ANY(keywords)
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        sites: result.rows,
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
    console.error('링크 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '링크 목록을 가져오는데 실패했습니다.',
      error: error.message
    });
  }
});

// 특정 링크 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        id, url, name, category, description, optimal_offset,
        keywords, usage_count, average_rtt, success_rate,
        created_at, updated_at
      FROM sites 
      WHERE id = $1 AND is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '링크를 찾을 수 없습니다.'
      });
    }

    // 사용 횟수 증가
    await pool.query(`
      UPDATE sites 
      SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('링크 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '링크 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 링크 추가 (인증 필요)
router.post('/', auth.required, [
  body('url').isURL().withMessage('유효한 URL을 입력해주세요'),
  body('name').isLength({ min: 1, max: 200 }).withMessage('사이트 이름은 1-200자 사이여야 합니다'),
  body('category').optional().isString().withMessage('카테고리는 문자열이어야 합니다'),
  body('description').optional().isString().withMessage('설명은 문자열이어야 합니다'),
  body('optimal_offset').optional().isInt({ min: 500, max: 10000 }).withMessage('최적 오프셋은 500-10000ms 사이여야 합니다'),
  body('keywords').optional().isArray().withMessage('키워드는 배열이어야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      url,
      name,
      category = 'general',
      description = null,
      optimal_offset = 2500,
      keywords = []
    } = req.body;

    const createdBy = req.user.id;

    // URL 중복 확인
    const existingResult = await pool.query(
      'SELECT id FROM sites WHERE url = $1',
      [url]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 등록된 URL입니다.'
      });
    }

    const result = await pool.query(`
      INSERT INTO sites (url, name, category, description, optimal_offset, keywords, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [url, name, category, description, optimal_offset, keywords, createdBy]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '링크가 성공적으로 추가되었습니다.'
    });

  } catch (error) {
    console.error('링크 추가 실패:', error);
    res.status(500).json({
      success: false,
      message: '링크 추가에 실패했습니다.',
      error: error.message
    });
  }
});

// 링크 수정 (인증 필요)
router.put('/:id', auth.required, [
  body('name').optional().isLength({ min: 1, max: 200 }).withMessage('사이트 이름은 1-200자 사이여야 합니다'),
  body('category').optional().isString().withMessage('카테고리는 문자열이어야 합니다'),
  body('description').optional().isString().withMessage('설명은 문자열이어야 합니다'),
  body('optimal_offset').optional().isInt({ min: 500, max: 10000 }).withMessage('최적 오프셋은 500-10000ms 사이여야 합니다'),
  body('keywords').optional().isArray().withMessage('키워드는 배열이어야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    // 사이트 존재 및 권한 확인
    const siteResult = await pool.query(
      'SELECT * FROM sites WHERE id = $1 AND is_active = true',
      [id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '링크를 찾을 수 없습니다.'
      });
    }

    const site = siteResult.rows[0];
    
    // 작성자가 아니면 수정 불가 (관리자 제외)
    if (site.created_by !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '링크를 수정할 권한이 없습니다.'
      });
    }

    const allowedFields = ['name', 'category', 'description', 'optimal_offset', 'keywords'];
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
      return res.status(400).json({
        success: false,
        message: '업데이트할 필드가 없습니다.'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(id);

    const query = `
      UPDATE sites 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);

    res.json({
      success: true,
      data: result.rows[0],
      message: '링크가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('링크 수정 실패:', error);
    res.status(500).json({
      success: false,
      message: '링크 수정에 실패했습니다.',
      error: error.message
    });
  }
});

// 링크 삭제 (인증 필요) - 소프트 삭제
router.delete('/:id', auth.required, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 사이트 존재 및 권한 확인
    const siteResult = await pool.query(
      'SELECT * FROM sites WHERE id = $1 AND is_active = true',
      [id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '링크를 찾을 수 없습니다.'
      });
    }

    const site = siteResult.rows[0];
    
    // 작성자가 아니면 삭제 불가 (관리자 제외)
    if (site.created_by !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '링크를 삭제할 권한이 없습니다.'
      });
    }

    // 소프트 삭제
    await pool.query(`
      UPDATE sites 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    res.json({
      success: true,
      message: '링크가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('링크 삭제 실패:', error);
    res.status(500).json({
      success: false,
      message: '링크 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

// 카테고리별 링크 수 조회
router.get('/stats/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(success_rate) as avg_success_rate,
        AVG(average_rtt) as avg_rtt
      FROM sites 
      WHERE is_active = true 
      GROUP BY category 
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('카테고리 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '카테고리 통계 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// 인기 링크 조회
router.get('/stats/popular', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('제한은 1-50 사이여야 합니다'),
  query('category').optional().isString().withMessage('카테고리는 문자열이어야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { limit = 10, category } = req.query;

    let query = `
      SELECT 
        id, url, name, category, usage_count, success_rate, average_rtt
      FROM sites 
      WHERE is_active = true
    `;
    const params = [];

    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }

    query += ` ORDER BY usage_count DESC, success_rate DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('인기 링크 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: '인기 링크 조회에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;