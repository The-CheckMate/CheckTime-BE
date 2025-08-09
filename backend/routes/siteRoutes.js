// 사이트 관리 API 라우트
const express = require('express');
const SiteService = require('../services/SiteService');
const auth = require('../middlewares/auth');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

const siteService = new SiteService();

// 모든 사이트 조회
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('페이지는 1 이상이어야 합니다'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('제한은 1-100 사이여야 합니다'),
  query('category').optional().isString().withMessage('카테고리는 문자열이어야 합니다'),
  query('sortBy').optional().isIn(['usage_count', 'success_rate', 'name', 'created_at']).withMessage('잘못된 정렬 기준입니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20, category, sortBy = 'usage_count' } = req.query;
    const result = await siteService.getAllSites(parseInt(page), parseInt(limit), category, sortBy);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 사이트 검색
router.get('/search', [
  query('q').notEmpty().withMessage('검색어를 입력해주세요'),
  query('auto_discover').optional().isBoolean().withMessage('auto_discovery는 boolean이어야 합니다')
], auth.optional, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { q: searchTerm, auto_discover } = req.query;
    const autoDiscover = auto_discover === 'false' ? false : true;
    const result = await siteService.searchSites(searchTerm, autoDiscover);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 새 사이트 추가
router.post('/', auth.required, [
  body('url').isURL().withMessage('유효한 URL을 입력해주세요'),
  body('name').notEmpty().withMessage('사이트 이름을 입력해주세요'),
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

    const siteData = req.body;
    const createdBy = req.user.id;
    
    const result = await siteService.addSite(siteData, createdBy);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 사이트 업데이트
router.put('/:id', auth.required, [
  body('name').optional().notEmpty().withMessage('사이트 이름은 비어있을 수 없습니다'),
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
    
    const result = await siteService.updateSite(parseInt(id), updateData, userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 사이트 삭제
router.delete('/:id', auth.required, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await siteService.deleteSite(parseInt(id), userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 인기 사이트 조회
router.get('/popular', [
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
    
    const result = await siteService.getPopularSites(parseInt(limit), category);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 카테고리 목록 조회
router.get('/categories', async (req, res) => {
  try {
    const result = await siteService.getCategories();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// URL 자동 보정 제안
router.post('/suggest-correction', [
  body('inputUrl').notEmpty().withMessage('URL을 입력해주세요')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { inputUrl } = req.body;
    const result = await siteService.suggestUrlCorrection(inputUrl);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 사이트 성능 분석
router.get('/:id/performance', [
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

    const { id } = req.params;
    const { days = 30 } = req.query;
    
    const result = await siteService.analyzeSitePerformance(parseInt(id), parseInt(days));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;