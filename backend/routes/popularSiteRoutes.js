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
    const limitNum = Number(limit);

    if (!['daily', 'weekly', 'realtime', 'all'].includes(period)) {
        return res.status(400).json({ 
            success: false, 
            error: "유효하지 않은 기간입니다. 'daily', 'weekly', 'realtime', 'all' 중 하나를 선택하세요." 
        });
    }
    if (!Number.isInteger(limitNum) || limitNum <= 0) {
        return res.status(400).json({
            success: false,
            error: "유효하지 않은 limit 값입니다. 양의 정수여야 합니다."
        });
    }

    try {
        let popularSites;
        if (period === 'all') {
            popularSites = await popularService.getOverallPopularSites(category, limitNum);
        } else {
            popularSites = await popularService.getPopularSites(period, category, limitNum);
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
