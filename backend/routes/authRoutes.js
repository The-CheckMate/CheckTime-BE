// 인증 관련 API 라우트
const express = require('express');
const AuthService = require('../services/AuthService');
const auth = require('../middlewares/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const authService = new AuthService();

// 회원가입
router.post('/register', [
  body('email').isEmail().withMessage('유효한 이메일을 입력해주세요'),
  body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자리여야 합니다'),
  body('username').isLength({ min: 2, max: 50 }).withMessage('사용자명은 2-50자 사이여야 합니다'),
  body('timezone').optional().isString().withMessage('시간대는 문자열이어야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, username, timezone = 'Asia/Seoul' } = req.body;
    
    const result = await authService.register(email, password, username, timezone);
    
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

// 로그인
router.post('/login', [
  body('email').isEmail().withMessage('유효한 이메일을 입력해주세요'),
  body('password').notEmpty().withMessage('비밀번호를 입력해주세요')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    
    const result = await authService.login(email, password);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// 토큰 갱신
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('리프레시 토큰이 필요합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { refreshToken } = req.body;
    
    const result = await authService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// 프로필 조회
router.get('/profile', auth.required, async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await authService.getProfile(userId);
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 프로필 업데이트
router.put('/profile', auth.required, [
  body('username').optional().isLength({ min: 2, max: 50 }).withMessage('사용자명은 2-50자 사이여야 합니다'),
  body('timezone').optional().isString().withMessage('시간대는 문자열이어야 합니다'),
  body('preferences').optional().isObject().withMessage('설정은 객체여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const updateData = req.body;
    
    const result = await authService.updateProfile(userId, updateData);
    
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

// 비밀번호 변경
router.put('/password', auth.required, [
  body('currentPassword').notEmpty().withMessage('현재 비밀번호를 입력해주세요'),
  body('newPassword').isLength({ min: 6 }).withMessage('새 비밀번호는 최소 6자리여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    await authService.changePassword(userId, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: '비밀번호가 변경되었습니다'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


module.exports = router;