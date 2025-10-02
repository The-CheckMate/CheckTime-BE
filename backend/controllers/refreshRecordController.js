const RefreshRecordService = require('../services/RefreshRecordService');
const refreshRecordService = new RefreshRecordService();

// 반응속도 테스트를 위한 고정 site_id
// DB에서 INSERT INTO sites (url, name, category) VALUES ('reaction-test', '반응속도 테스트', 'test'); 실행 후
// 해당 ID를 여기에 설정
const REACTION_TEST_SITE_ID = 48;

/**
 * 반응속도 기록 저장
 * POST /api/refresh-records
 * Body: { refreshTime: number }
 */
exports.saveRecord = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { refreshTime } = req.body;

    // 입력 검증
    if (!refreshTime || typeof refreshTime !== 'number' || refreshTime <= 0) {
      return res.status(400).json({
        success: false,
        error: '유효한 반응속도 값이 필요합니다 (숫자, 0보다 큼)'
      });
    }

    // 너무 빠른 값은 부정 방지 (물리적으로 불가능)
    if (refreshTime < 50) {
      return res.status(400).json({
        success: false,
        error: '기록이 너무 빠릅니다. 정상적인 방법으로 측정해주세요'
      });
    }

    const result = await refreshRecordService.saveRefreshRecord(
      userId,
      REACTION_TEST_SITE_ID,
      refreshTime
    );

    res.json({
      success: true,
      message: result.isNewBest ? '🎉 새로운 최고 기록입니다!' : '기록이 저장되었습니다',
      data: result.record,
      isNewBest: result.isNewBest
    });
  } catch (error) {
    console.error('Save record error:', error);
    next(error);
  }
};

/**
 * 순위 조회
 * GET /api/refresh-records/rankings?type=best&limit=100
 */
exports.getRankings = async (req, res, next) => {
  try {
    const { type = 'best', limit = 100 } = req.query;

    // 입력 검증
    if (!['best', 'average'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type은 "best" 또는 "average"여야 합니다'
      });
    }

    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({
        success: false,
        error: 'limit은 1-1000 사이의 숫자여야 합니다'
      });
    }

    const result = await refreshRecordService.getSiteRankings(
      REACTION_TEST_SITE_ID,
      type,
      parsedLimit
    );

    res.json(result);
  } catch (error) {
    console.error('Get rankings error:', error);
    next(error);
  }
};

/**
 * 내 순위 조회
 * GET /api/refresh-records/my-rank
 */
exports.getMyRank = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await refreshRecordService.getUserRank(
      userId,
      REACTION_TEST_SITE_ID
    );

    res.json(result);
  } catch (error) {
    console.error('Get my rank error:', error);
    next(error);
  }
};

/**
 * 주변 순위 조회
 * GET /api/refresh-records/nearby?range=5
 */
exports.getNearbyRankings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { range = 5 } = req.query;

    const parsedRange = parseInt(range);
    if (isNaN(parsedRange) || parsedRange < 1 || parsedRange > 50) {
      return res.status(400).json({
        success: false,
        error: 'range는 1-50 사이의 숫자여야 합니다'
      });
    }

    const result = await refreshRecordService.getNearbyRankings(
      userId,
      REACTION_TEST_SITE_ID,
      parsedRange
    );

    res.json(result);
  } catch (error) {
    console.error('Get nearby rankings error:', error);
    next(error);
  }
};

/**
 * 전체 통계 조회 (로그인 선택)
 * GET /api/refresh-records/stats
 */
exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    // TOP 10 순위
    const topRankings = await refreshRecordService.getSiteRankings(
      REACTION_TEST_SITE_ID,
      'best',
      10
    );
    
    // 사용자 통계 (로그인한 경우만)
    let userStats = null;
    if (userId) {
      const userRank = await refreshRecordService.getUserRank(
        userId,
        REACTION_TEST_SITE_ID
      );
      userStats = userRank.rank || null;
    }

    res.json({
      success: true,
      data: {
        topRankings: topRankings.rankings || [],
        userStats: userStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    next(error);
  }
};

module.exports = {
  saveRecord: exports.saveRecord,
  getRankings: exports.getRankings,
  getMyRank: exports.getMyRank,
  getNearbyRankings: exports.getNearbyRankings,
  getStats: exports.getStats
};