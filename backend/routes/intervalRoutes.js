// 인터벌 계산 API 라우트
const express = require("express");
const IntervalService = require("../services/IntervalService");
const NetworkService = require('../services/NetworkService');
const auth = require("../middlewares/auth");
const { body, validationResult } = require("express-validator");
//const AccessLog = require("../models/AccessLog");
const router = express.Router();

const intervalService = new IntervalService();

// 최적 인터벌 계산
// 최적 인터벌 계산 - 수정된 버전
router.post("/calculate", async (req, res) => {
  try {
    const { targetUrl, targetTime, userAlertOffsets } = req.body;

    if (!targetUrl || !targetTime) {
      return res.status(400).json({
        success: false,
        error: "targetUrl과 targetTime이 필요합니다",
      });
    }

    // 기존 IntervalService 함수 활용하되, 성공률 데이터 추가 조회
    const result = await intervalService.calculateOptimalInterval(
      targetUrl, 
      targetTime, 
      req.user?.id || null,
      userAlertOffsets
    );
        
    // 성공률 기반 추가 정보 포함하여 응답
    res.json({
      success: true,
      data: {
        ...result,
        // 기존 API 호환성 유지
        targetTime: result.targetTime,
        currentTime: result.currentTime,
        optimalRefreshTime: result.optimalRefreshTime,
        refreshInterval: result.refreshInterval,
        timeUntilRefresh: result.timeUntilRefresh,
        alertSettings: result.alertSettings,
        confidence: result.confidenceScore / 100, // 기존 형식 유지
        
        // 동적 요소들 (기존 호환)
        dynamicFactors: {
          currentRTT: result.networkAnalysis?.averageRTT || 0,
          networkCondition: result.networkAnalysis?.condition || 'unknown',
          successRate: result.historicalData? 
            `${result.historicalData.toFixed(1)}%` : "N/A",
          dynamicOffset: result.refreshInterval,
          timeBasedAdjustment: result.timeBasedMultiplier > 1 ? 
            `+${Math.round((result.timeBasedMultiplier - 1) * 100)}%` : "none",
          randomFactor: (0.95 + Math.random() * 0.1).toFixed(3),
        },

        recommendation: result.recommendations?.[0] || `${Math.round(result.refreshInterval / 1000)}초 전에 새로고침하세요`,
        
        metadata: {
          calculatedAt: result.calculatedAt || new Date().toISOString(),
          basedOnSamples: result.historicalData?.totalAttempts || 0,
          ntpSyncStatus: "synced",
          rttSamples: 3,
          algorithmVersion: "2.2-success-optimized",
        },
      },
    });

  } catch (error) {
    console.error("인터벌 계산 오류:", error);
    
    // 기존 폴백 로직 유지
    const fallback = intervalService.getFallbackResult(targetUrl, targetTime, error.message);
    
    res.status(500).json({
      success: false,
      error: "인터벌 계산 중 오류가 발생했습니다",
      data: fallback,
      details: error.message,
    });
  }
});

// 실시간 인터벌 조정
router.post(
  "/adjust",
  [body("targetUrl").isURL().withMessage("유효한 URL을 입력해주세요"), body("currentOffset").isInt({ min: 500, max: 10000 }).withMessage("현재 오프셋은 500-10000ms 사이여야 합니다")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { targetUrl, currentOffset } = req.body;
      const result = await intervalService.adjustIntervalBasedOnRealtimeData(targetUrl, currentOffset);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// 배치 인터벌 계산
router.post(
  "/batch",
  [
    body("requests").isArray({ min: 1, max: 10 }).withMessage("요청은 1-10개 사이여야 합니다"),
    body("requests.*.targetUrl").isURL().withMessage("모든 URL이 유효해야 합니다"),
    body("requests.*.targetTime").isISO8601().withMessage("모든 날짜가 유효해야 합니다"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { requests } = req.body;
      const results = await intervalService.calculateMultipleIntervals(requests);

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// 접속 결과 로깅
router.post(
  "/log-access",
  auth.optional,
  [
    body("url").optional().isURL().withMessage("유효한 url이어야 합니다."),
    body("siteId").optional().isInt().withMessage("유효한 사이트 ID여야 합니다"),
    body("success").isBoolean().withMessage("성공 여부는 boolean이어야 합니다"),
    body("rtt").optional().isFloat({ min: 0 }).withMessage("RTT는 0 이상이어야 합니다"),
    body("optimalOffset").isInt({ min: 0 }).withMessage("최적 오프셋은 0 이상이어야 합니다"),
    body("confidenceScore").isFloat({ min: 0, max: 1 }).withMessage("신뢰도는 0-1 사이여야 합니다"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }
      
      const { siteurl, siteId, targetTime, rtt, networkDelay,success, optimalOffset, confidenceScore} = req.body;
      const userId = req.user?.id || null;
      const Input = { siteurl, userId, siteId, targetTime, rtt, networkDelay, success, optimalOffset, confidenceScore}
      await intervalService.logAccessAttempt(Input);

      res.json({
        success: true,
        message: "접속 결과가 기록되었습니다",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;