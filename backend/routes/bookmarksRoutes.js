const express = require('express');
const { body, param, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');
const BookmarksService = require('../services/BookmarksService');
const SiteService      = require('../services/SiteService');
const router = express.Router();

const bmSvc = new BookmarksService();
const siteSvc = new SiteService();

// 전체 조회
router.get('/', auth.required, async (req, res) => {
  try {
    const list = await bmSvc.list(req.user.id);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 추가
router.post(
  '/',
  auth.required,
  [
    body('custom_name').isString().notEmpty(),
    body('custom_url').isString().notEmpty(),
    body('favicon').optional().isURL()
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) {
      return res.status(400).json({ success: false, errors: errs.array() });
    }
    try {
      const { custom_name, custom_url, favicon } = req.body;
      const bm = await bmSvc.add(req.user.id, custom_name, custom_url, favicon);
      res.status(201).json({ success: true, data: bm });
    } catch (err) {
      const status = err.message.includes('최대') ? 400
                   : err.message.includes('이미') ? 409
                   : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

// 삭제
router.delete(
  '/:id',
  auth.required,
  [ param('id').isInt() ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) {
      return res.status(400).json({ success: false, errors: errs.array() });
    }
    try {
      const removed = await bmSvc.remove(req.user.id, parseInt(req.params.id));
      res.json({ success: true, data: removed });
    } catch (err) {
      const status = err.message.includes('찾을 수 없습니다') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

// 수정
router.put(
  '/:id',
  auth.required,
  [
    param('id').isInt(),
    body('custom_name').optional().isString(),
    body('custom_url').optional().isString(),
    body('favicon').optional().isURL()
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) {
      return res.status(400).json({ success: false, errors: errs.array() });
    }
    try {
      const bm = await bmSvc.update(
        req.user.id,
        parseInt(req.params.id),
        req.body.custom_name,
        req.body.custom_url,
        req.body.favicon
      );
      res.json({ success: true, data: bm });
    } catch (err) {
      const status = err.message.includes('중복') ? 409
                   : err.message.includes('찾을 수 없습니다') ? 404
                   : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

/**
 * 북마크 클릭 → URL로 사이트 검색
 * GET /api/bookmarks/:id/click
 */
router.get(
  '/:id/click',
  auth.required,
  [ param('id').isInt().withMessage('유효한 북마크 ID여야 합니다') ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const userId = req.user.id;
      const bookmarkId = parseInt(req.params.id);

      // 1) 북마크의 URL 조회
      const url = await bmSvc.getUrlById(userId, bookmarkId);

      // 2) SiteService로 검색 수행
      const result = await siteSvc.searchSites(url, /* autoDiscover= */ true);

      // 3) 결과 반환
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err.message;
      if (msg.includes('찾을 수 없습니다')) {
        return res.status(404).json({ success: false, error: msg });
      }
      console.error('북마크 클릭 처리 실패:', err);
      res.status(500).json({ success: false, error: '검색 중 오류가 발생했습니다' });
    }
  }
);

module.exports = router;