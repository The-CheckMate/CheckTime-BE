const express = require('express');
const { body, param, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');
const BookmarksService = require('../services/BookmarksService');
const router = express.Router();
const svc = new BookmarksService();

// 전체 조회
router.get('/', auth.required, async (req, res) => {
  try {
    const list = await svc.list(req.user.id);
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
      const bm = await svc.add(req.user.id, custom_name, custom_url, favicon);
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
      const removed = await svc.remove(req.user.id, parseInt(req.params.id));
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
      const bm = await svc.update(
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

module.exports = router;