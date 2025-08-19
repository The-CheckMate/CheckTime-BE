// backend/routes/macroRoutes.js
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');
const MacroService = require('../services/MacroService');
const router = express.Router();

const macroService = new MacroService();

// =====================================
// 1. 매크로 작업 예약 및 실행
// =====================================

/**
 * 매크로 작업 예약
 * POST /api/macro/schedule
 */
router.post('/schedule', auth.optional, [
    body('targetUrl').isURL().withMessage('유효한 URL을 입력해주세요'),
    body('targetTime').isISO8601().withMessage('유효한 목표 시간을 입력해주세요'),
    body('macroType').isIn(['refresh', 'post', 'get', 'form']).withMessage('유효한 매크로 타입을 선택해주세요'),
    body('userConsent').isBoolean().withMessage('사용자 동의가 필요합니다'),
    body('settings').optional().isObject().withMessage('설정은 객체 형태여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { targetUrl, targetTime, macroType, userConsent, settings = {} } = req.body;
        const userId = req.user?.id || null;

        // 사용자 동의 확인
        if (!userConsent) {
            return res.status(400).json({
                success: false,
                error: '매크로 실행을 위해서는 사용자 동의가 필요합니다'
            });
        }

        // 목표 시간이 현재 시간보다 미래인지 확인
        const targetDateTime = new Date(targetTime);
        const now = new Date();
        
        if (targetDateTime <= now) {
            return res.status(400).json({
                success: false,
                error: '목표 시간은 현재 시간보다 미래여야 합니다'
            });
        }

        // 최대 예약 시간 제한 (24시간)
        const maxTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        if (targetDateTime > maxTime) {
            return res.status(400).json({
                success: false,
                error: '목표 시간은 24시간 이내여야 합니다'
            });
        }

        const result = await macroService.scheduleMacroTask(
            userId, targetUrl, targetTime, macroType, settings, userConsent
        );

        res.json({
            success: true,
            data: {
                taskId: result.task.id,
                targetUrl,
                targetTime: targetDateTime.toISOString(),
                macroType,
                optimalTiming: result.optimalTiming,
                status: 'scheduled',
                message: '매크로 작업이 예약되었습니다'
            }
        });

    } catch (error) {
        console.error('매크로 예약 오류:', error);
        res.status(500).json({
            success: false,
            error: '매크로 예약 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 매크로 즉시 실행
 * POST /api/macro/execute
 */
router.post('/execute', auth.optional, [
    body('targetUrl').isURL().withMessage('유효한 URL을 입력해주세요'),
    body('macroType').isIn(['refresh', 'post', 'get', 'form']).withMessage('유효한 매크로 타입을 선택해주세요'),
    body('userConsent').isBoolean().withMessage('사용자 동의가 필요합니다'),
    body('settings').optional().isObject().withMessage('설정은 객체 형태여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { targetUrl, macroType, userConsent, settings = {} } = req.body;
        const userId = req.user?.id || null;

        if (!userConsent) {
            return res.status(400).json({
                success: false,
                error: '매크로 실행을 위해서는 사용자 동의가 필요합니다'
            });
        }

        // 즉시 실행
        const result = await macroService.performMacroAction(targetUrl, macroType, settings);

        // 실행 로그 기록
        await macroService.logExecution(null, {
            user_id: userId,
            target_url: targetUrl,
            macro_type: macroType
        }, result.success, result.responseTime, result, result.error);

        res.json({
            success: true,
            data: {
                executionResult: result,
                timestamp: new Date().toISOString(),
                message: result.success ? '매크로 실행 성공' : '매크로 실행 실패'
            }
        });

    } catch (error) {
        console.error('매크로 실행 오류:', error);
        res.status(500).json({
            success: false,
            error: '매크로 실행 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =====================================
// 2. 매크로 작업 관리
// =====================================

/**
 * 예약된 매크로 작업 조회
 * GET /api/macro/tasks
 */
router.get('/tasks', auth.optional, [
    query('status').optional().isIn(['scheduled', 'running', 'completed', 'failed', 'cancelled']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { status, page = 1, limit = 20 } = req.query;
        const userId = req.user?.id;

        const result = await macroService.getUserTasks(userId, status, parseInt(page), parseInt(limit));

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('매크로 작업 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '매크로 작업 조회 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 특정 매크로 작업 상세 조회
 * GET /api/macro/tasks/:taskId
 */
router.get('/tasks/:taskId', auth.optional, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id;

        const task = await macroService.getTaskById(taskId);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: '매크로 작업을 찾을 수 없습니다'
            });
        }

        // 권한 확인 (로그인한 사용자는 자신의 작업만, 비로그인은 익명 작업만)
        if (userId && task.user_id !== userId && task.user_id !== null) {
            return res.status(403).json({
                success: false,
                error: '해당 작업에 접근할 권한이 없습니다'
            });
        } else if (!userId && task.user_id !== null) {
            return res.status(403).json({
                success: false,
                error: '해당 작업에 접근할 권한이 없습니다'
            });
        }

        // 실행 로그 조회
        const logs = await macroService.pool.query(`
            SELECT attempt_number, executed_at, success, response_time, error_message
            FROM macro_execution_logs 
            WHERE task_id = $1 
            ORDER BY executed_at DESC
        `, [taskId]);

        res.json({
            success: true,
            data: {
                task,
                executionLogs: logs.rows
            }
        });

    } catch (error) {
        console.error('매크로 작업 상세 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '매크로 작업 상세 조회 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 매크로 작업 취소
 * DELETE /api/macro/tasks/:taskId
 */
router.delete('/tasks/:taskId', auth.optional, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id;

        const result = await macroService.cancelTask(taskId, userId);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('매크로 작업 취소 오류:', error);
        
        if (error.message.includes('권한이 없습니다')) {
            return res.status(403).json({
                success: false,
                error: error.message
            });
        } else if (error.message.includes('찾을 수 없습니다')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        } else if (error.message.includes('취소할 수 없습니다')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: '매크로 작업 취소 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =====================================
// 3. 예약된 작업 실행 (크론잡용)
// =====================================

/**
 * 예약된 매크로 작업 체크 및 실행
 * POST /api/macro/check-scheduled
 */
router.post('/check-scheduled', async (req, res) => {
    try {
        const results = await macroService.checkScheduledTasks();
        
        res.json({
            success: true,
            data: {
                executedCount: results.length,
                results,
                message: `${results.length}개의 예약된 매크로가 실행되었습니다`
            }
        });

    } catch (error) {
        console.error('예약된 매크로 체크 오류:', error);
        res.status(500).json({
            success: false,
            error: '예약된 매크로 체크 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =====================================
// 4. 통계 및 모니터링
// =====================================

/**
 * 매크로 실행 통계
 * GET /api/macro/stats
 */
router.get('/stats', auth.optional, [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('일수는 1-365 사이여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { days = 30 } = req.query;
        const userId = req.user?.id;

        const stats = await macroService.getExecutionStats(userId, parseInt(days));

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('매크로 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '매크로 통계 조회 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 시스템 모니터링
 * GET /api/macro/monitor
 */
router.get('/monitor', auth.optional, async (req, res) => {
    try {
        const monitoring = await macroService.getSystemMonitoring();

        res.json({
            success: true,
            data: monitoring
        });

    } catch (error) {
        console.error('매크로 모니터링 오류:', error);
        res.status(500).json({
            success: false,
            error: '매크로 모니터링 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =====================================
// 5. 프리셋 관리
// =====================================

/**
 * 매크로 프리셋 저장
 * POST /api/macro/presets
 */
router.post('/presets', auth.required, [
    body('name').isLength({ min: 1, max: 100 }).withMessage('프리셋 이름은 1-100자 사이여야 합니다'),
    body('settings').isObject().withMessage('설정은 객체 형태여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, settings } = req.body;
        const userId = req.user.id;

        const result = await macroService.savePreset(userId, name, settings);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('프리셋 저장 오류:', error);
        res.status(500).json({
            success: false,
            error: '프리셋 저장 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 사용자 매크로 프리셋 조회
 * GET /api/macro/presets
 */
router.get('/presets', auth.required, async (req, res) => {
    try {
        res.json({
            success: true,
            data: presets
        });

    } catch (error) {
        console.error('프리셋 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '프리셋 조회 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 매크로 프리셋 삭제
 * DELETE /api/macro/presets/:name
 */
router.delete('/presets/:name', auth.required, async (req, res) => {
    try {
        const { name } = req.params;
        const userId = req.user.id;

        const result = await macroService.deletePreset(userId, name);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('프리셋 삭제 오류:', error);
        
        if (error.message.includes('찾을 수 없습니다')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: '프리셋 삭제 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =====================================
// 6. 유틸리티 및 관리 기능
// =====================================

/**
 * 만료된 작업 정리
 * POST /api/macro/cleanup
 */
router.post('/cleanup', auth.optional, [
    body('days').optional().isInt({ min: 1, max: 365 }).withMessage('일수는 1-365 사이여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { days = 30 } = req.body;
        const result = await macroService.cleanupExpiredTasks(days);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('작업 정리 오류:', error);
        res.status(500).json({
            success: false,
            error: '작업 정리 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 매크로 설정 검증
 * POST /api/macro/validate-settings
 */
router.post('/validate-settings', [
    body('macroType').isIn(['refresh', 'post', 'get', 'form']).withMessage('유효한 매크로 타입을 선택해주세요'),
    body('settings').isObject().withMessage('설정은 객체 형태여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { macroType, settings } = req.body;
        const validationResult = validateMacroSettings(macroType, settings);

        res.json({
            success: true,
            data: validationResult
        });

    } catch (error) {
        console.error('설정 검증 오류:', error);
        res.status(500).json({
            success: false,
            error: '설정 검증 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 매크로 테스트 실행 (실제 요청 없이 설정만 검증)
 * POST /api/macro/test
 */
router.post('/test', auth.optional, [
    body('targetUrl').isURL().withMessage('유효한 URL을 입력해주세요'),
    body('macroType').isIn(['refresh', 'post', 'get', 'form']).withMessage('유효한 매크로 타입을 선택해주세요'),
    body('settings').optional().isObject().withMessage('설정은 객체 형태여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { targetUrl, macroType, settings = {} } = req.body;

        // 설정 검증
        const settingsValidation = validateMacroSettings(macroType, settings);
        if (!settingsValidation.valid) {
            return res.status(400).json({
                success: false,
                error: '설정이 유효하지 않습니다',
                details: settingsValidation.errors
            });
        }

        // URL 접근성 테스트 (HEAD 요청)
        try {
            const axios = require('axios');
            const response = await axios.head(targetUrl, {
                timeout: 5000,
                validateStatus: function (status) {
                    return status < 500; // 5xx 에러만 reject
                }
            });

            res.json({
                success: true,
                data: {
                    targetUrl,
                    macroType,
                    settings: settingsValidation.normalizedSettings,
                    urlAccessible: true,
                    urlStatus: response.status,
                    urlStatusText: response.statusText,
                    message: '매크로 설정이 유효하고 URL에 접근 가능합니다'
                }
            });

        } catch (urlError) {
            res.json({
                success: true,
                data: {
                    targetUrl,
                    macroType,
                    settings: settingsValidation.normalizedSettings,
                    urlAccessible: false,
                    urlError: urlError.message,
                    message: '매크로 설정은 유효하지만 URL 접근에 문제가 있을 수 있습니다'
                }
            });
        }

    } catch (error) {
        console.error('매크로 테스트 오류:', error);
        res.status(500).json({
            success: false,
            error: '매크로 테스트 중 오류가 발생했습니다',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =====================================
// 7. 헬퍼 함수들
// =====================================

/**
 * 매크로 설정 검증 함수
 */
function validateMacroSettings(macroType, settings) {
    const result = {
        valid: true,
        errors: [],
        normalizedSettings: { ...settings }
    };

    // 공통 설정 검증
    if (settings.timeout && (typeof settings.timeout !== 'number' || settings.timeout < 1000 || settings.timeout > 30000)) {
        result.valid = false;
        result.errors.push('타임아웃은 1000-30000ms 사이여야 합니다');
    } else if (!settings.timeout) {
        result.normalizedSettings.timeout = 10000; // 기본값
    }

    if (settings.headers && typeof settings.headers !== 'object') {
        result.valid = false;
        result.errors.push('헤더는 객체 형태여야 합니다');
    }

    // 매크로 타입별 설정 검증
    switch (macroType) {
        case 'post':
            if (settings.body && typeof settings.body !== 'object' && typeof settings.body !== 'string') {
                result.valid = false;
                result.errors.push('POST 요청 본문은 객체 또는 문자열이어야 합니다');
            }
            break;

        case 'form':
            if (!settings.formFields || typeof settings.formFields !== 'object') {
                result.valid = false;
                result.errors.push('폼 매크로에는 formFields 객체가 필요합니다');
            }

            if (settings.contentType && !['multipart/form-data', 'application/x-www-form-urlencoded'].includes(settings.contentType)) {
                result.valid = false;
                result.errors.push('폼 contentType은 multipart/form-data 또는 application/x-www-form-urlencoded여야 합니다');
            } else if (!settings.contentType) {
                result.normalizedSettings.contentType = 'application/x-www-form-urlencoded';
            }
            break;

        case 'refresh':
        case 'get':
            // 특별한 검증 불필요
            break;

        default:
            result.valid = false;
            result.errors.push(`지원하지 않는 매크로 타입: ${macroType}`);
    }

    return result;
}

/**
 * 에러 핸들러 미들웨어
 */
router.use((error, req, res, next) => {
    console.error('매크로 라우트 에러:', error);
    
    res.status(500).json({
        success: false,
        error: '서버 내부 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

module.exports = router;