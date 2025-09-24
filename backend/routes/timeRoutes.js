// 시간 관련 API 라우트
const express = require("express");
const TimeService = require("../services/TimeService");
const SiteService = require("../services/SiteService");
const IntervalService = require("../services/IntervalService");
const router = express.Router();
const axios = require("axios");

const timeService = new TimeService();
const siteService = new SiteService();
const intervalService = new IntervalService();

// 현재 정확한 시간 조회
router.get("/current", async (req, res) => {
  try {
    const currentTime = await timeService.getCurrentTime();
    res.json({
      success: true,
      data: currentTime,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// NTP 동기화 실행
router.post("/sync", async (req, res) => {
  try {
    const syncResult = await timeService.syncWithNTP();
    res.json({
      success: true,
      data: syncResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 동기화 상태 확인
router.get("/sync-status", async (req, res) => {
  try {
    const status = timeService.getSyncStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 특정 시간대의 현재 시간
router.get("/timezone/:timezone", async (req, res) => {
  try {
    const { timezone } = req.params;
    const timeInTimezone = timeService.getCurrentTimeInTimezone(timezone);
    res.json({
      success: true,
      data: timeInTimezone,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 타겟 서버와의 시간 차이 측정
 */
router.post("/compare", async (req, res) => {
  try {
    const { targetUrl, userId } = req.body; //userId 없으면 null 처리
        
    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        error: "targetUrl이 필요합니다",
      });
    }

    // 1. 우리 서버의 정확한 시간 (NTP 동기화)
    const timeService = new TimeService();
    const ourTimeData = await timeService.getCurrentTime();
    const ourTime = new Date(ourTimeData.serverTime);

    // 2. 타겟 서버의 시간 측정
    const startTime = Date.now();

    try {
      const response = await axios.head(targetUrl, {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NavismBot/1.0)",
        },
      });

      const endTime = Date.now();
      const rtt = endTime - startTime;

      // HTTP Date 헤더에서 서버 시간 추출
      const serverDateHeader = response.headers.date;

      if (!serverDateHeader) {
        return res.json({
          success: false,
          error: "타겟 서버에서 시간 정보를 제공하지 않습니다",
          data: {
            targetUrl,
            ourTime: ourTime.toISOString(),
            rtt: rtt,
            recommendation: "NTP 동기화 시간 사용을 권장합니다",
          },
        });
      }

      const targetServerTime = new Date(serverDateHeader);

      // 네트워크 지연 보정
      const networkDelay = rtt / 2;
      const correctedTargetTime = new Date(targetServerTime.getTime() + networkDelay);

      // 시간 차이 계산
      const timeDifference = correctedTargetTime.getTime() - ourTime.getTime();

      // 신뢰도 평가
      let reliability = "medium";
      if (rtt > 500) reliability = "low";
      else if (rtt < 100) reliability = "high";
      
      //로그 저장 시도
      logInput = {};
      try{
        const siteId = await siteService.getSiteByUrl(targetUrl);
        if(siteId!= null) siteId = siteId.id;

        logInput = {
          siteurl: targetUrl,
          userId: userId || null,
          siteId: siteId || null, 
          rtt: rtt, 
          success: true, 
          // optimalOffset: || 2500, // ||기본 오프셋
          // confidenceScore: 
        }
        console.log(logInput);

      }catch(error) {
        logInput.success = false;
        console.error('접속 로그 저장 실패:', error);
      } finally {
        //로그 기록
        const logResult = await intervalService.logAccessAttempt(logInput);
      }

      // 응답 데이터 구성
      res.json({
        success: true,
        data: {
          targetUrl,
          timeComparison: {
            ourServerTime: ourTime.toISOString(),
            targetServerTime: targetServerTime.toISOString(), 
            correctedTargetTime: correctedTargetTime.toISOString(),
            timeDifference: timeDifference,
            timeDifferenceFormatted: formatTimeDifference(timeDifference),
            direction: timeDifference > 0 ? "target_ahead" : "target_behind",
          },
          networkInfo: {
            rtt: rtt,
            networkDelay: networkDelay,
            reliability: reliability,
          },
          analysis: {
            accuracy: "HTTP Date 헤더 기반 (참고용)",
            recommendation: Math.abs(timeDifference) > 1000 ? "NTP 동기화 시간 사용을 강력히 권장합니다" : "시간 차이가 작으므로 양호합니다",
            trustLevel: reliability === "high" ? 0.7 : reliability === "medium" ? 0.5 : 0.3,
          },
          metadata: {
            measuredAt: new Date().toISOString(),
            ntpSyncStatus: ourTimeData.lastSyncTime ? "synced" : "not_synced",
            ntpAccuracy: ourTimeData.accuracy || "unknown",
          },
        },
      });
    } catch (networkError) {
      res.status(500).json({
        success: false,
        error: "타겟 서버에 연결할 수 없습니다",
        details: networkError.message,
        data: {
          targetUrl,
          ourTime: ourTime.toISOString(),
          recommendation: "URL을 확인하거나 다른 서버를 시도해보세요",
        },
      });
    }
  } catch (error) {
    console.error("시간 비교 오류:", error);
    res.status(500).json({
      success: false,
      error: "시간 비교 중 오류가 발생했습니다",
      details: error.message,
    });
  }
});

/**
 * 시간 차이를 읽기 쉬운 형태로 포맷
 */
function formatTimeDifference(diffMs) {
  const absDiff = Math.abs(diffMs);
  const sign = diffMs >= 0 ? "+" : "-";

  if (absDiff < 1000) {
    return `${sign}${absDiff}ms`;
  } else if (absDiff < 60000) {
    const seconds = (absDiff / 1000).toFixed(3);
    return `${sign}${seconds}초`;
  } else {
    const minutes = Math.floor(absDiff / 60000);
    const seconds = ((absDiff % 60000) / 1000).toFixed(1);
    return `${sign}${minutes}분 ${seconds}초`;
  }
}

module.exports = router;
