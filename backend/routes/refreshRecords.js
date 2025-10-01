const express = require('express');
const router = express.Router();
const refreshRecordController = require('../controllers/refreshRecordController');
const auth = require('../middlewares/auth');

/**
 * POST /api/refresh-records
 * 반응속도 기록 저장
 * 인증 필수
 * Body: { refreshTime: number }
 */
router.post(
  '/', 
  auth.required, 
  refreshRecordController.saveRecord
);

/**
 * GET /api/refresh-records/rankings
 * 전체 순위 조회
 * 인증 불필요
 * Query Params:
 *   - type: 'best' | 'average' (기본값: 'best')
 *   - limit: number (기본값: 100, 최대: 1000)
 */
router.get(
  '/rankings', 
  refreshRecordController.getRankings
);

/**
 * GET /api/refresh-records/my-rank
 * 내 순위 조회
 * 인증 필수
 */
router.get(
  '/my-rank', 
  auth.required, 
  refreshRecordController.getMyRank
);

/**
 * GET /api/refresh-records/nearby
 * 주변 순위 조회 (내 순위 기준 ±N명)
 * 인증 필수
 * Query Params:
 *   - range: number (기본값: 5, 최대: 50)
 */
router.get(
  '/nearby', 
  auth.required, 
  refreshRecordController.getNearbyRankings
);

/**
 * GET /api/refresh-records/stats
 * 전체 통계 조회 (TOP 10 + 내 기록)
 * 인증 선택 (로그인하면 내 기록도 함께 반환)
 */
router.get(
  '/stats', 
  auth.optional, 
  refreshRecordController.getStats
);

module.exports = router;