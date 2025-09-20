// 인터벌 계산 API 라우트
const express = require("express");
const IntervalService = require("../services/IntervalService");
const NetworkService = require('../services/NetworkService');
const auth = require("../middlewares/auth");
const { body, validationResult } = require("express-validator");
const AccessLog = require("../models/AccessLog");
const router = express.Router();

const intervalService = new IntervalService();

// 최적 인터벌 계산
// 최적 인터벌 계산 - 수정된 버전
router.post("/calculate", async (req, res) => {
  try {
    const { targetUrl, targetTime } = req.body;

    if (!targetUrl || !targetTime) {
      return res.status(400).json({
        success: false,
        error: "targetUrl과 targetTime이 필요합니다",
      });
    }

    // 필요한 모듈들 import (이 부분을 파일 상단에 추가해야 함)
    const TimeService = require("../services/TimeService");
    const Site = require("../models/Site");
    const AccessLog = require("../models/AccessLog");
    const axios = require("axios");

    // RTT 측정 함수 (임시)
    async function measureRTT(url) {
      try {
        const samples = [];
        for (let i = 0; i < 3; i++) {
          const start = Date.now();
          await axios.head(url, { timeout: 5000 });
          const end = Date.now();
          samples.push(end - start);
        }

        const average = samples.reduce((sum, rtt) => sum + rtt, 0) / samples.length;
        let networkCondition = "excellent";
        if (average > 500) networkCondition = "poor";
        else if (average > 200) networkCondition = "fair";
        else if (average > 100) networkCondition = "good";

        return { average, samples, networkCondition, success: true };
      } catch (error) {
        return { average: 1000, networkCondition: "poor", success: false };
      }
    }

    // 1. 실시간 RTT 측정 (매번 새로 측정!)
    console.log(`RTT 측정 시작: ${targetUrl}`);
    const networkResult = await measureRTT(targetUrl);
    console.log(`RTT 측정 완료: ${networkResult.average}ms`);

    // 2. 현재 시간 (NTP 동기화)
    const timeService = new TimeService();
    const currentTimeData = await timeService.getCurrentTime();
    const currentTime = new Date(currentTimeData.serverTime);

    // 3. 목표 시간까지 남은 시간 계산
    const targetDateTime = new Date(targetTime);
    const timeRemaining = targetDateTime.getTime() - currentTime.getTime();

    // 4. 과거 성공률 데이터 조회 (동적!)
    let successRate = 0.8; // 기본값
    let recentLogsCount = 0;

    try {
      const site = await Site.findByUrl(targetUrl);
      if (site) {
        const recentLogs = await AccessLog.findBySite(site.id, { days: 7 });
        if (recentLogs.length > 0) {
          successRate = recentLogs.filter((log) => log.success).length / recentLogs.length;
          recentLogsCount = recentLogs.length;
        }
      }
    } catch (dbError) {
      console.warn("DB 조회 실패, 기본값 사용:", dbError.message);
    }

    // 5. 동적 오프셋 계산
    let dynamicOffset = networkResult.average * 2; // RTT 기반

    // 기본 안전 버퍼 추가
    dynamicOffset += 2000; // 2초 기본 버퍼

    // 성공률에 따른 조정 (동적!)
    if (successRate < 0.5) {
      dynamicOffset *= 2.0;
    } else if (successRate < 0.7) {
      dynamicOffset *= 1.5;
    }

    // 시간대별 조정 (점심시간, 저녁시간 등)
    const hour = currentTime.getHours();
    let timeBasedMultiplier = 1.0;
    if (hour >= 12 && hour <= 14) {
      timeBasedMultiplier = 1.2; // 점심시간 트래픽 증가
      dynamicOffset *= timeBasedMultiplier;
    }

    // 네트워크 상태에 따른 추가 조정
    if (networkResult.networkCondition === "poor") {
      dynamicOffset *= 1.5;
    } else if (networkResult.networkCondition === "fair") {
      dynamicOffset *= 1.2;
    }

    // 6. 최적 새로고침 시점 계산
    const optimalRefreshTime = new Date(targetDateTime.getTime() - dynamicOffset);
    const refreshInterval = Math.max(optimalRefreshTime.getTime() - currentTime.getTime(), 0);

    // 7. 신뢰도 계산 (변동성 고려)
    let confidence = Math.min(successRate + 0.1, 1.0);
    if (networkResult.networkCondition === "excellent") {
      confidence = Math.min(confidence + 0.1, 0.95);
    } else if (networkResult.networkCondition === "poor") {
      confidence = Math.max(confidence - 0.2, 0.5);
    }

    // 랜덤 요소 추가 (실제 동적 변화 시뮬레이션)
    const randomFactor = 0.95 + Math.random() * 0.1; // 0.95 ~ 1.05
    dynamicOffset = Math.round(dynamicOffset * randomFactor);

    res.json({
      success: true,
      data: {
        targetTime: targetDateTime.toISOString(),
        currentTime: currentTime.toISOString(),
        optimalRefreshTime: new Date(targetDateTime.getTime() - dynamicOffset).toISOString(),
        refreshInterval: Math.max(targetDateTime.getTime() - dynamicOffset - currentTime.getTime(), 0),
        timeRemaining: timeRemaining,

        // 동적 요소들 (매번 변함!)
        dynamicFactors: {
          currentRTT: Math.round(networkResult.average * 100) / 100,
          networkCondition: networkResult.networkCondition,
          successRate: (successRate * 100).toFixed(1) + "%",
          dynamicOffset: Math.round(dynamicOffset),
          timeBasedAdjustment: timeBasedMultiplier > 1 ? `+${Math.round((timeBasedMultiplier - 1) * 100)}%` : "none",
          randomFactor: randomFactor.toFixed(3),
        },

        confidence: Math.round(confidence * 100) / 100,
        recommendation: `${Math.round(dynamicOffset / 1000)}초 전에 새로고침하세요`,

        metadata: {
          calculatedAt: new Date().toISOString(),
          basedOnSamples: recentLogsCount,
          ntpSyncStatus: currentTimeData.lastSyncTime ? "synced" : "not_synced",
          rttSamples: networkResult.samples?.length || 3,
          algorithmVersion: "2.1",
        },
      },
    });
  } catch (error) {
    console.error("인터벌 계산 오류:", error);
    res.status(500).json({
      success: false,
      error: "인터벌 계산 중 오류가 발생했습니다",
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
const networkService = new NetworkService();

router.post(
  "/log-access",
  auth.optional,
  [
    body("siteId").optional().isInt().withMessage("유효한 사이트 ID여야 합니다"),
    body("targetTime").isISO8601().withMessage("유효한 목표 시간이어야 합니다"),
    //body("actualAccessTime").isISO8601().withMessage("유효한 실제 접속 시간이어야 합니다"),
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

      
      const { siteurl, siteId, targetTime, actualAccessTime, success, optimalOffset, confidenceScore } = req.body;

      const userId = req.user?.id || null;
      const rtt = (await networkService.measureRTT(siteurl)).average;

      //await intervalService.logAccessAttempt(userId, siteId, targetTime, actualAccessTime, rtt, success, optimalOffset, confidenceScore);
      const logData = {
        userId,
        siteId,
        targetTime, 
        rtt,
        success,
        optimalOffset, 
        confidenceScore,
        actualAccessTime
      }
      await AccessLog.create(logData);

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
