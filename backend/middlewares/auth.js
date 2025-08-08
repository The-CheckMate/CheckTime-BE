// 인증 미들웨어
const AuthService = require('../services/AuthService');

const authService = new AuthService();

/**
 * 필수 인증 미들웨어
 */
const required = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '인증 토큰이 필요합니다'
      });
    }
    
    const token = authHeader.substring(7); // 'Bearer ' 제거
    const decoded = authService.verifyToken(token);
    
    // 사용자 정보를 req.user에 저장
    req.user = { id: decoded.userId };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: '유효하지 않은 인증 토큰입니다'
    });
  }
};

/**
 * 선택적 인증 미들웨어
 */
const optional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = authService.verifyToken(token);
      req.user = { id: decoded.userId };
    }
    
    next();
  } catch (error) {
    // 선택적 인증이므로 에러가 발생해도 계속 진행
    next();
  }
};

module.exports = {
  required,
  optional
};