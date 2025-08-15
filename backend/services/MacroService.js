// backend/services/MacroService.js
const { Pool } = require('pg');
const axios = require('axios');

class MacroService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    /**
     * 매크로 작업 예약
     */
    async scheduleMacroTask(userId, targetUrl, targetTime, macroType, settings, userConsent) {
        try {
            // 기존 IntervalService 활용하여 최적 타이밍 계산
            const IntervalService = require('./IntervalService');
            const intervalService = new IntervalService();
            
            const optimalTiming = await intervalService.calculateOptimalInterval(targetUrl, targetTime);
            
            // 매크로 타입별 추가 오프셋 적용
            const macroTypeOffsets = {
                'refresh': 0,
                'get': 100,      // GET 요청은 약간 빠르게
                'post': 200,     // POST 요청은 더 빠르게
                'form': 300      // 폼 제출은 가장 빠르게
            };
            
            const additionalOffset = macroTypeOffsets[macroType] || 0;
            const adjustedOptimalTime = new Date(
                new Date(optimalTiming.optimalRefreshTime).getTime() - additionalOffset
            );

            const result = await this.pool.query(`
                INSERT INTO macro_tasks (
                    user_id, target_url, target_time, macro_type, 
                    optimal_refresh_time, settings, user_consent, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
                RETURNING *
            `, [
                userId, targetUrl, new Date(targetTime), macroType,
                adjustedOptimalTime, JSON.stringify(settings), userConsent
            ]);

            return {
                task: result.rows[0],
                optimalTiming: {
                    ...optimalTiming,
                    optimalRefreshTime: adjustedOptimalTime.toISOString(),
                    macroTypeOffset: additionalOffset,
                    recommendation: `${macroType} 매크로용으로 ${additionalOffset}ms 추가 조정됨`
                }
            };
        } catch (error) {
            console.error('매크로 작업 예약 오류:', error);
            throw new Error(`매크로 작업 예약 실패: ${error.message}`);
        }
    }

    /**
     * 특정 매크로 작업 실행
     */
    async executeMacro(taskId) {
    try {
        const task = await this.getTaskById(taskId);
        if (!task || task.status !== 'scheduled') {
            throw new Error(`Task not found or not schedulable`);
        }

        await this.updateTaskStatus(taskId, 'running');

        const settings = typeof task.settings === 'string' 
            ? JSON.parse(task.settings) 
            : (task.settings || {});
        const result = await this.performMacroAction(
            task.target_url, 
            task.macro_type, 
            settings
        );

        if (result.success) {
            // 🔧 안전한 결과 저장
            await this.updateTaskStatus(taskId, 'completed', result);
            await this.logExecution(taskId, task, true, result.responseTime, result);
            return { success: true, result };
        } else {
            // 🔧 안전한 실패 저장  
            await this.updateTaskStatus(taskId, 'failed', null, result.error);
            await this.logExecution(taskId, task, false, result.responseTime, null, result.error);
            throw new Error(result.error);
        }
    } catch (error) {
        console.error(`매크로 실행 오류 (Task ID: ${taskId}):`, error);
        
        // 🔧 안전한 에러 저장
        try {
            await this.updateTaskStatus(taskId, 'failed', null, error.message);
        } catch (updateError) {
            console.error('상태 업데이트 실패:', updateError);
        }
        
        throw error;
    }
}
    /**
     * 실제 매크로 동작 수행
     */
    async performMacroAction(targetUrl, macroType, settings) {
        const startTime = Date.now();
        
        try {
            let response;
            const config = {
                timeout: settings.timeout || 10000,
                headers: {
                    'User-Agent': 'Navism-Macro/1.0',
                    ...settings.headers
                },
                validateStatus: function (status) {
                    return status < 500; // 5xx 에러만 reject
                }
            };

            switch (macroType) {
                case 'refresh':
                case 'get':
                    response = await axios.get(targetUrl, config);
                    break;
                    
                case 'post':
                    response = await axios.post(targetUrl, settings.body || {}, config);
                    break;
                    
                case 'form':
                    // 폼 데이터 처리
                    if (settings.contentType === 'multipart/form-data') {
                        const FormData = require('form-data');
                        const formData = new FormData();
                        
                        if (settings.formFields) {
                            Object.entries(settings.formFields).forEach(([key, value]) => {
                                formData.append(key, value);
                            });
                        }
                        
                        config.headers = {
                            ...config.headers,
                            ...formData.getHeaders()
                        };
                        
                        response = await axios.post(targetUrl, formData, config);
                    } else {
                        // application/x-www-form-urlencoded
                        const params = new URLSearchParams();
                        if (settings.formFields) {
                            Object.entries(settings.formFields).forEach(([key, value]) => {
                                params.append(key, value);
                            });
                        }
                        
                        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                        response = await axios.post(targetUrl, params, config);
                    }
                    break;
                    
                default:
                    throw new Error(`지원하지 않는 매크로 타입: ${macroType}`);
            }

            const responseTime = Date.now() - startTime;
            
            return {
                success: response.status >= 200 && response.status < 400,
                responseTime,
                statusCode: response.status,
                statusText: response.statusText,
                headers: response.headers,
                dataSize: response.data ? JSON.stringify(response.data).length : 0,
                responseData: macroType === 'get' ? response.data : null // GET 요청만 데이터 저장
            };
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                success: false,
                responseTime,
                error: error.message,
                errorCode: error.code || 'UNKNOWN_ERROR',
                statusCode: error.response?.status || null,
                statusText: error.response?.statusText || null
            };
        }
    }

    /**
     * 예약된 작업들 확인 및 실행
     */
    async checkScheduledTasks() {
        try {
            const now = new Date();
            
            const tasks = await this.pool.query(`
                SELECT * FROM macro_tasks 
                WHERE status = 'scheduled' 
                AND optimal_refresh_time <= $1
                ORDER BY optimal_refresh_time ASC
                LIMIT 50
            `, [now]);

            const results = [];
            
            for (const task of tasks.rows) {
                try {
                    console.log(`매크로 실행 시작: Task ID ${task.id}, URL: ${task.target_url}`);
                    const result = await this.executeMacro(task.id);
                    results.push({ 
                        taskId: task.id, 
                        targetUrl: task.target_url,
                        success: true, 
                        result: result.result 
                    });
                } catch (error) {
                    console.error(`매크로 실행 실패: Task ID ${task.id}`, error);
                    results.push({ 
                        taskId: task.id, 
                        targetUrl: task.target_url,
                        success: false, 
                        error: error.message 
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('예약된 작업 체크 오류:', error);
            throw error;
        }
    }

    /**
     * 사용자의 매크로 작업 조회 (안전한 버전)
     */
    async getUserTasks(userId, status = null, page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            
            // 기본 쿼리 구성
            let whereConditions = [];
            let params = [];
            let paramIndex = 1;

            // 사용자 조건 추가
            if (userId) {
                whereConditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`);
                params.push(userId);
                paramIndex++;
            } else {
                whereConditions.push(`user_id IS NULL`);
            }

            // 상태 조건 추가
            if (status) {
                whereConditions.push(`status = $${paramIndex}`);
                params.push(status);
                paramIndex++;
            }

            // WHERE 절 구성
            const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

            // 메인 쿼리
            const mainQuery = `
                SELECT 
                    id, target_url, target_time, macro_type, optimal_refresh_time,
                    status, created_at, executed_at, result_data, error_message
                FROM macro_tasks
                ${whereClause}
                ORDER BY created_at DESC 
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            // 메인 쿼리 파라미터 추가
            const mainParams = [...params, limit, offset];

            console.log('실행할 메인 쿼리:', mainQuery);
            console.log('메인 쿼리 파라미터:', mainParams);

            const result = await this.pool.query(mainQuery, mainParams);

            // 카운트 쿼리 (동일한 WHERE 조건 사용)
            const countQuery = `
                SELECT COUNT(*) as count
                FROM macro_tasks
                ${whereClause}
            `;

            console.log('실행할 카운트 쿼리:', countQuery);
            console.log('카운트 쿼리 파라미터:', params);

            const countResult = await this.pool.query(countQuery, params);
            const totalCount = parseInt(countResult.rows[0].count);

            const totalPages = Math.ceil(totalCount / limit);

            return {
                tasks: result.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    totalCount: totalCount,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };

        } catch (error) {
            console.error('getUserTasks 상세 에러:', {
                message: error.message,
                code: error.code,
                detail: error.detail,
                where: error.where,
                stack: error.stack
            });
            throw new Error(`매크로 작업 조회 실패: ${error.message}`);
        }
    }

    /**
     * 매크로 작업 취소
     */
    async cancelTask(taskId, userId = null) {
        try {
            // 권한 확인을 위한 작업 조회
            let checkQuery = 'SELECT id, status FROM macro_tasks WHERE id = $1';
            const checkParams = [taskId];

            if (userId) {
                checkQuery += ' AND (user_id = $2 OR user_id IS NULL)';
                checkParams.push(userId);
            } else {
                checkQuery += ' AND user_id IS NULL';
            }

            const checkResult = await this.pool.query(checkQuery, checkParams);

            if (checkResult.rows.length === 0) {
                throw new Error('작업을 찾을 수 없거나 권한이 없습니다');
            }

            const task = checkResult.rows[0];

            if (task.status === 'completed' || task.status === 'failed') {
                throw new Error('이미 완료되거나 실패한 작업은 취소할 수 없습니다');
            }

            if (task.status === 'cancelled') {
                throw new Error('이미 취소된 작업입니다');
            }

            // 작업 취소
            await this.pool.query(`
                UPDATE macro_tasks 
                SET status = 'cancelled', executed_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [taskId]);

            return { success: true, message: '작업이 취소되었습니다' };
        } catch (error) {
            console.error('작업 취소 오류:', error);
            throw error;
        }
    }

    /**
     * 매크로 실행 통계 조회
     */
    async getExecutionStats(userId = null, days = 30) {
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_executions,
                    COUNT(CASE WHEN success THEN 1 END) as successful_executions,
                    AVG(response_time) as avg_response_time,
                    MIN(response_time) as min_response_time,
                    MAX(response_time) as max_response_time,
                    macro_type
                FROM macro_execution_logs 
                WHERE executed_at > CURRENT_DATE - INTERVAL '${days} days'
            `;

            if (userId) {
                query += ` AND (user_id = ${userId} OR user_id IS NULL)`;
            } else {
                query += ` AND user_id IS NULL`;
            }

            query += ` GROUP BY macro_type ORDER BY total_executions DESC`;

            const result = await this.pool.query(query);

            // 전체 요약 통계
            let summaryQuery = `
                SELECT 
                    COUNT(*) as total_executions,
                    COUNT(CASE WHEN success THEN 1 END) as successful_executions,
                    AVG(response_time) as avg_response_time
                FROM macro_execution_logs 
                WHERE executed_at > CURRENT_DATE - INTERVAL '${days} days'
            `;

            if (userId) {
                summaryQuery += ` AND (user_id = ${userId} OR user_id IS NULL)`;
            } else {
                summaryQuery += ` AND user_id IS NULL`;
            }

            const summaryResult = await this.pool.query(summaryQuery);
            const summary = summaryResult.rows[0];

            // 성공률 계산
            const successRate = summary.total_executions > 0 
                ? (summary.successful_executions / summary.total_executions) * 100 
                : 0;

            return {
                period: `${days} days`,
                summary: {
                    ...summary,
                    success_rate: successRate.toFixed(2) + '%'
                },
                byMacroType: result.rows.map(row => ({
                    ...row,
                    success_rate: ((row.successful_executions / row.total_executions) * 100).toFixed(2) + '%'
                }))
            };
        } catch (error) {
            console.error('통계 조회 오류:', error);
            throw error;
        }
    }

    /**
     * 프리셋 관리
     */
    async savePreset(userId, name, settings) {
        try {
            // 중복 이름 확인
            const existingResult = await this.pool.query(`
                SELECT id FROM macro_presets 
                WHERE user_id = $1 AND name = $2
            `, [userId, name]);

            if (existingResult.rows.length > 0) {
                // 업데이트
                await this.pool.query(`
                    UPDATE macro_presets 
                    SET settings = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $2 AND name = $3
                `, [JSON.stringify(settings), userId, name]);
            } else {
                // 새로 생성
                await this.pool.query(`
                    INSERT INTO macro_presets (user_id, name, settings)
                    VALUES ($1, $2, $3)
                `, [userId, name, JSON.stringify(settings)]);
            }

            return { success: true, message: `프리셋 '${name}'이 저장되었습니다` };
        } catch (error) {
            console.error('프리셋 저장 오류:', error);
            throw error;
        }
    }

    async getUserPresets(userId) {
        try {
            const result = await this.pool.query(`
                SELECT name, settings, created_at, updated_at
                FROM macro_presets 
                WHERE user_id = $1 
                ORDER BY updated_at DESC
            `, [userId]);

            return result.rows;
        } catch (error) {
            console.error('프리셋 조회 오류:', error);
            throw error;
        }
    }

    async deletePreset(userId, name) {
        try {
            const result = await this.pool.query(`
                DELETE FROM macro_presets 
                WHERE user_id = $1 AND name = $2
                RETURNING name
            `, [userId, name]);

            if (result.rows.length === 0) {
                throw new Error('프리셋을 찾을 수 없습니다');
            }

            return { success: true, message: `프리셋 '${name}'이 삭제되었습니다` };
        } catch (error) {
            console.error('프리셋 삭제 오류:', error);
            throw error;
        }
    }

    // ===========================================
    // 헬퍼 메소드들
    // ===========================================

    /**
     * 작업 ID로 작업 조회
     */
    async getTaskById(taskId) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM macro_tasks WHERE id = $1', 
                [taskId]
            );
            return result.rows[0];
        } catch (error) {
            console.error('작업 조회 오류:', error);
            throw error;
        }
    }

    /**
     * 작업 상태 업데이트
     */
    async updateTaskStatus(taskId, status, resultData = null, errorMessage = null) {
        try {
            console.log('🔍 updateTaskStatus 호출:', { taskId, status, resultData: typeof resultData });
            
            let safeResultData = null;
            if (resultData !== null && resultData !== undefined) {
                if (typeof resultData === 'object') {
                    safeResultData = JSON.stringify(resultData);
                } else {
                    safeResultData = String(resultData);
                }
            }
            
            await this.pool.query(`
                UPDATE macro_tasks 
                SET status = $1, executed_at = CURRENT_TIMESTAMP, 
                    result_data = $2, error_message = $3
                WHERE id = $4
            `, [status, safeResultData, errorMessage, taskId]);
            
            console.log('✅ updateTaskStatus 성공');
        } catch (error) {
            console.error('❌ updateTaskStatus 실패:', error);
            throw error;
        }
    }

    /**
     * 실행 로그 기록
     */
    async logExecution(taskId, task, success, responseTime, resultData, errorMessage = null) {
        try {
            // 디버깅용 로그 추가
            console.log('🔍 logExecution 호출됨:');
            console.log('  resultData type:', typeof resultData);
            console.log('  resultData value:', resultData);
            
            // 안전한 JSON 변환
            let safeResultData = null;
            if (resultData) {
                if (typeof resultData === 'string') {
                    safeResultData = resultData;
                } else if (typeof resultData === 'object') {
                    safeResultData = JSON.stringify(resultData);
                } else {
                    safeResultData = String(resultData);
                }
            }
            
            await this.pool.query(`
                INSERT INTO macro_execution_logs (
                    task_id, user_id, target_url, macro_type, success, 
                    response_time, result_data, error_message
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                taskId, 
                task.user_id, 
                task.target_url, 
                task.macro_type, 
                success, 
                responseTime, 
                safeResultData,  // 안전하게 변환된 데이터
                errorMessage
            ]);
        } catch (error) {
            console.error('로그 기록 오류:', error);
            console.error('전달받은 데이터:', { taskId, success, responseTime, resultData, errorMessage });
            // 로그 기록 실패는 전체 프로세스를 중단시키지 않음
        }
    }

    /**
     * 시스템 모니터링 정보 조회
     */
    async getSystemMonitoring() {
        try {
            // 현재 실행 중인 작업
            const runningTasks = await this.pool.query(`
                SELECT COUNT(*) as count FROM macro_tasks WHERE status = 'running'
            `);

            // 예약 대기 중인 작업
            const scheduledTasks = await this.pool.query(`
                SELECT COUNT(*) as count FROM macro_tasks WHERE status = 'scheduled'
            `);

            // 최근 1시간 실행 통계
            const recentStats = await this.pool.query(`
                SELECT 
                    COUNT(*) as total_executions,
                    COUNT(CASE WHEN success THEN 1 END) as successful_executions,
                    AVG(response_time) as avg_response_time
                FROM macro_execution_logs 
                WHERE executed_at > NOW() - INTERVAL '1 hour'
            `);

            const stats = recentStats.rows[0];
            const systemLoad = {
                runningTasks: parseInt(runningTasks.rows[0].count),
                scheduledTasks: parseInt(scheduledTasks.rows[0].count),
                recentExecutions: parseInt(stats.total_executions) || 0,
                successRate: stats.total_executions > 0 
                    ? ((stats.successful_executions / stats.total_executions) * 100).toFixed(2) + '%'
                    : '0%',
                avgResponseTime: Math.round(parseFloat(stats.avg_response_time) || 0)
            };

            return {
                timestamp: new Date().toISOString(),
                systemLoad,
                status: systemLoad.runningTasks < 50 ? 'healthy' : 'high_load'
            };
        } catch (error) {
            console.error('시스템 모니터링 조회 오류:', error);
            throw error;
        }
    }

    /**
     * 만료된 작업 정리
     */
    async cleanupExpiredTasks(days = 30) {
        try {
            // 완료/실패/취소된 작업 중 오래된 것들 삭제
            const result = await this.pool.query(`
                DELETE FROM macro_tasks 
                WHERE status IN ('completed', 'failed', 'cancelled')
                AND executed_at < CURRENT_TIMESTAMP - INTERVAL '${days} days'
            `);

            // 오래된 실행 로그도 정리 (task_id가 NULL인 것만)
            const logResult = await this.pool.query(`
                DELETE FROM macro_execution_logs 
                WHERE task_id IS NULL 
                AND executed_at < CURRENT_TIMESTAMP - INTERVAL '${days * 3} days'
            `);

            return {
                deletedTasks: result.rowCount,
                deletedLogs: logResult.rowCount,
                message: `${result.rowCount}개 작업과 ${logResult.rowCount}개 로그가 정리되었습니다`
            };
        } catch (error) {
            console.error('만료된 작업 정리 오류:', error);
            throw error;
        }
    }
}

module.exports = MacroService;