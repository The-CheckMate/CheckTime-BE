const express = require('express');
const router = express.Router();
const popularService = require('../services/PopularSiteService');

/**
 * @route GET /api/popular-sites
 * @desc 인기 사이트 목록을 조회
 * @param {string} period - 'daily', 'weekly', 'realtime', 'all'
 * @param {string} [category] - 조회할 카테고리 (예: '티켓팅', '대학')
 * @param {number} [limit=5] - 가져올 사이트 수
 */
router.get('/popular-sites', async (req, res) => {
    const { period, category, limit = 5 } = req.query;

    if (!['daily', 'weekly', 'realtime', 'all'].includes(period)) {
        return res.status(400).json({ 
            success: false, 
            error: "유효하지 않은 기간입니다. 'daily', 'weekly', 'realtime', 'all' 중 하나를 선택하세요." 
        });
    }
    if (isNaN(parseInt(limit)) || parseInt(limit) <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid limit. Must be a positive integer."
        });
    }

    try {
        let popularSites;
        if (period === 'all') {
            popularSites = await popularService.getOverallPopularSites(category, parseInt(limit));
        } else {
            popularSites = await popularService.getPopularSites(period, category, parseInt(limit));
        }

        res.json({
            success: true,
            data: {
                period,
                category: category || '전체',
                sites: popularSites
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
