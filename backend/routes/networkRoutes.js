// 네트워크 측정 API 라우트
const express = require('express');
const NetworkService = require('../services/NetworkService');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const networkService = new NetworkService();

// RTT 측정
router.post('/rtt', [
  body('targetUrl').isURL().withMessage('유효한 URL을 입력해주세요'),
  body('sampleCount').optional().isInt({ min: 1, max: 20 }).withMessage('샘플 수는 1-20 사이여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { targetUrl, sampleCount = 5 } = req.body;
    const rttResult = await networkService.measureRTT(targetUrl, sampleCount);
    
    res.json({
      success: true,
      data: rttResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 종합 네트워크 분석
router.post('/analyze', [
  body('targetUrl').isURL().withMessage('유효한 URL을 입력해주세요')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { targetUrl } = req.body;
    const analysis = await networkService.comprehensiveNetworkAnalysis(targetUrl);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 크리스티안 알고리즘 적용
router.post('/christian', [
  body('targetUrl').isURL().withMessage('유효한 URL을 입력해주세요'),
  body('samples').optional().isInt({ min: 1, max: 10 }).withMessage('샘플 수는 1-10 사이여야 합니다')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { targetUrl, samples = 5 } = req.body;
    const result = await networkService.applyChristianAlgorithm(targetUrl, samples);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;