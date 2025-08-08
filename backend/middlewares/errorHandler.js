// 에러 핸들링 미들웨어
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // 기본 에러 정보
  let error = {
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };
  
  // 환경에 따른 에러 정보 노출
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
    error.details = err;
  }
  
  // 상태 코드 결정
  let statusCode = 500;
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError' || err.message.includes('token')) {
    statusCode = 401;
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
  } else if (err.code === '23505') { // PostgreSQL unique constraint violation
    statusCode = 409;
    error.message = '중복된 데이터입니다';
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    error.message = '참조된 데이터가 존재하지 않습니다';
  }
  
  res.status(statusCode).json(error);
};

module.exports = errorHandler;