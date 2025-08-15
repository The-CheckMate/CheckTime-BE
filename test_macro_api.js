// test_macro_api.js - 매크로 API 종합 테스트 스크립트
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
let testResults = { 
    passed: 0, 
    failed: 0, 
    warnings: 0,
    errors: [],
    createdTaskIds: [] // 생성된 작업 ID 추적
};

// 컬러 로그 함수
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
        success: '\x1b[32m✅',   // 녹색
        error: '\x1b[31m❌',     // 빨간색
        warning: '\x1b[33m⚠️',   // 노란색
        info: '\x1b[36mℹ️',      // 청록색
        reset: '\x1b[0m'
    };
    
    const prefix = colors[type] || colors.info;
    console.log(`${prefix} [${timestamp}] ${message}${colors.reset}`);
}

function assert(condition, message, isWarning = false) {
    if (condition) {
        testResults.passed++;
        log(`PASS: ${message}`, 'success');
    } else {
        if (isWarning) {
            testResults.warnings++;
            log(`WARN: ${message}`, 'warning');
        } else {
            testResults.failed++;
            testResults.errors.push(message);
            log(`FAIL: ${message}`, 'error');
        }
    }
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, `${message} (Expected: ${expected}, Actual: ${actual})`);
}

// 딜레이 함수
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 테스트 함수들 =====

async function testBasicConnectivity() {
    log('=== 1. 기본 연결성 테스트 ===', 'info');
    
    try {
        // 1.1 기본 헬스체크
        log('기본 헬스체크 테스트 중...');
        const healthRes = await axios.get('http://localhost:3001/health');
        assertEqual(healthRes.status, 200, '기본 헬스체크 상태 코드');
        assertEqual(healthRes.data.status, 'OK', '기본 헬스체크 응답');
        
        // 1.2 매크로 헬스체크
        log('매크로 시스템 헬스체크 테스트 중...');
        const macroHealthRes = await axios.get(`${BASE_URL}/health/macro`);
        assert([200, 503].includes(macroHealthRes.status), '매크로 헬스체크 응답');
        assert(macroHealthRes.data.success !== undefined, '매크로 헬스체크 success 필드 존재');
        
        if (macroHealthRes.data.data) {
            log(`매크로 시스템 상태: ${macroHealthRes.data.data.status}`, 'info');
            log(`크론잡 실행 상태: ${macroHealthRes.data.data.cronJobs?.running || 'unknown'}`, 'info');
        }
        
        // 1.3 관리자 크론잡 상태 확인
        log('크론잡 상태 확인 중...');
        const cronStatusRes = await axios.get(`${BASE_URL}/admin/cron-status`);
        assertEqual(cronStatusRes.status, 200, '크론잡 상태 조회 상태 코드');
        assert(cronStatusRes.data.success, '크론잡 상태 조회 성공');
        
        if (cronStatusRes.data.data) {
            log(`크론잡 실행 중: ${cronStatusRes.data.data.isRunning}`, 'info');
            log(`총 크론잡 수: ${cronStatusRes.data.data.totalJobs}`, 'info');
            log(`활성 크론잡 수: ${cronStatusRes.data.data.activeJobs}`, 'info');
        }
        
    } catch (error) {
        log(`기본 연결성 테스트 실패: ${error.response?.data?.error || error.message}`, 'error');
        testResults.failed++;
    }
}

async function testImmediateExecution() {
    log('\n=== 2. 즉시 실행 테스트 ===', 'info');
    
    try {
        // 2.1 GET 요청 즉시 실행
        log('GET 요청 즉시 실행 테스트 중...');
        const getExecuteData = {
            targetUrl: 'https://httpbin.org/get',
            macroType: 'get',
            userConsent: true,
            settings: {
                timeout: 8000,
                headers: {
                    'X-Test-Type': 'immediate-get',
                    'X-Test-Timestamp': new Date().toISOString()
                }
            }
        };
        
        const getRes = await axios.post(`${BASE_URL}/macro/execute`, getExecuteData);
        assertEqual(getRes.status, 200, 'GET 즉시 실행 상태 코드');
        assert(getRes.data.success, 'GET 즉시 실행 성공 플래그');
        assert(getRes.data.data.executionResult, 'GET 실행 결과 존재');
        
        const getResult = getRes.data.data.executionResult;
        assert(getResult.success, 'GET 실제 실행 성공');
        assert(getResult.responseTime > 0, 'GET 응답 시간 기록');
        assert(getResult.statusCode >= 200 && getResult.statusCode < 300, 'GET 성공 상태 코드');
        
        log(`GET 응답 시간: ${getResult.responseTime}ms`, 'info');
        log(`GET 상태 코드: ${getResult.statusCode}`, 'info');
        
        // 2.2 POST 요청 즉시 실행
        log('POST 요청 즉시 실행 테스트 중...');
        const postExecuteData = {
            targetUrl: 'https://httpbin.org/post',
            macroType: 'post',
            userConsent: true,
            settings: {
                timeout: 8000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Test-Type': 'immediate-post'
                },
                body: {
                    test: 'post-execution',
                    timestamp: new Date().toISOString(),
                    data: {
                        userId: 'test-user',
                        action: 'immediate-test'
                    }
                }
            }
        };
        
        const postRes = await axios.post(`${BASE_URL}/macro/execute`, postExecuteData);
        assertEqual(postRes.status, 200, 'POST 즉시 실행 상태 코드');
        assert(postRes.data.success, 'POST 즉시 실행 성공 플래그');
        
        const postResult = postRes.data.data.executionResult;
        assert(postResult.success, 'POST 실제 실행 성공');
        log(`POST 응답 시간: ${postResult.responseTime}ms`, 'info');
        
        // 2.3 폼 제출 즉시 실행
        log('폼 제출 즉시 실행 테스트 중...');
        const formExecuteData = {
            targetUrl: 'https://httpbin.org/post',
            macroType: 'form',
            userConsent: true,
            settings: {
                timeout: 8000,
                contentType: 'application/x-www-form-urlencoded',
                formFields: {
                    username: 'testuser',
                    email: 'test@example.com',
                    action: 'form-test',
                    timestamp: new Date().toISOString()
                }
            }
        };
        
        const formRes = await axios.post(`${BASE_URL}/macro/execute`, formExecuteData);
        assertEqual(formRes.status, 200, '폼 제출 즉시 실행 상태 코드');
        assert(formRes.data.success, '폼 제출 즉시 실행 성공 플래그');
        
        const formResult = formRes.data.data.executionResult;
        assert(formResult.success, '폼 제출 실제 실행 성공');
        log(`폼 제출 응답 시간: ${formResult.responseTime}ms`, 'info');
        
    } catch (error) {
        log(`즉시 실행 테스트 실패: ${error.response?.data?.error || error.message}`, 'error');
        testResults.failed++;
    }
}

async function testMacroScheduling() {
    log('\n=== 3. 매크로 예약 테스트 ===', 'info');
    
    try {
        // 3.1 단기 예약 테스트 (2분 후)
        log('단기 매크로 예약 테스트 중...');
        const shortTargetTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        
        const shortScheduleData = {
            targetUrl: 'https://httpbin.org/delay/1',
            targetTime: shortTargetTime,
            macroType: 'get',
            userConsent: true,
            settings: {
                timeout: 10000,
                headers: {
                    'X-Test-Type': 'scheduled-short'
                }
            }
        };
        
        const shortRes = await axios.post(`${BASE_URL}/macro/schedule`, shortScheduleData);
        assertEqual(shortRes.status, 200, '단기 예약 상태 코드');
        assert(shortRes.data.success, '단기 예약 성공 플래그');
        assert(shortRes.data.data.taskId, '단기 예약 작업 ID 존재');
        
        const shortTaskId = shortRes.data.data.taskId;
        testResults.createdTaskIds.push(shortTaskId);
        
        log(`단기 예약 작업 ID: ${shortTaskId}`, 'info');
        log(`단기 예약 목표 시간: ${shortTargetTime}`, 'info');
        log(`단기 예약 최적 실행 시간: ${shortRes.data.data.optimalTiming.optimalRefreshTime}`, 'info');
        
        // 3.2 장기 예약 테스트 (8시간 후)
        log('장기 매크로 예약 테스트 중...');
        const longTargetTime = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        
        const longScheduleData = {
            targetUrl: 'https://httpbin.org/status/200',
            targetTime: longTargetTime,
            macroType: 'refresh',
            userConsent: true,
            settings: {
                timeout: 15000
            }
        };
        
        const longRes = await axios.post(`${BASE_URL}/macro/schedule`, longScheduleData);
        assertEqual(longRes.status, 200, '장기 예약 상태 코드');
        assert(longRes.data.success, '장기 예약 성공 플래그');
        
        const longTaskId = longRes.data.data.taskId;
        testResults.createdTaskIds.push(longTaskId);
        
        log(`장기 예약 작업 ID: ${longTaskId}`, 'info');
        log(`장기 예약 시간까지: ${Math.round((new Date(longTargetTime) - new Date()) / 1000 / 60)}분`, 'info');
        
        // 3.3 POST 요청 예약
        log('POST 요청 예약 테스트 중...');
        const postTargetTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        
        const postScheduleData = {
            targetUrl: 'https://httpbin.org/post',
            targetTime: postTargetTime,
            macroType: 'post',
            userConsent: true,
            settings: {
                timeout: 12000,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    scheduledTest: true,
                    targetTime: postTargetTime,
                    testData: 'scheduled-post-macro'
                }
            }
        };
        
        const postScheduleRes = await axios.post(`${BASE_URL}/macro/schedule`, postScheduleData);
        assertEqual(postScheduleRes.status, 200, 'POST 예약 상태 코드');
        assert(postScheduleRes.data.success, 'POST 예약 성공 플래그');
        
        const postTaskId = postScheduleRes.data.data.taskId;
        testResults.createdTaskIds.push(postTaskId);
        
        log(`POST 예약 작업 ID: ${postTaskId}`, 'info');
        
        return [shortTaskId, longTaskId, postTaskId];
        
    } catch (error) {
        log(`매크로 예약 테스트 실패: ${error.response?.data?.error || error.message}`, 'error');
        testResults.failed++;
        return [];
    }
}

async function testTaskManagement(taskIds) {
    log('\n=== 4. 작업 관리 테스트 ===', 'info');
    
    try {
        // 4.1 모든 작업 목록 조회
        log('모든 작업 목록 조회 테스트 중...');
        const allTasksRes = await axios.get(`${BASE_URL}/macro/tasks?page=1&limit=20`);
        assertEqual(allTasksRes.status, 200, '전체 작업 목록 조회 상태 코드');
        assert(allTasksRes.data.success, '전체 작업 목록 조회 성공 플래그');
        assert(Array.isArray(allTasksRes.data.data.tasks), '작업 목록이 배열');
        assert(allTasksRes.data.data.pagination, '페이지네이션 정보 존재');
        
        log(`총 ${allTasksRes.data.data.tasks.length}개 작업 조회됨`, 'info');
        log(`전체 작업 수: ${allTasksRes.data.data.pagination.totalCount}`, 'info');
        
        // 4.2 상태별 작업 조회
        log('예약된 작업만 조회 테스트 중...');
        const scheduledRes = await axios.get(`${BASE_URL}/macro/tasks?status=scheduled&page=1&limit=10`);
        assertEqual(scheduledRes.status, 200, '예약된 작업 조회 상태 코드');
        assert(scheduledRes.data.success, '예약된 작업 조회 성공 플래그');
        
        log(`예약된 작업: ${scheduledRes.data.data.tasks.length}개`, 'info');
        
        // 4.3 특정 작업 상세 조회
        if (taskIds.length > 0) {
            const taskId = taskIds[0];
            log(`작업 ${taskId} 상세 조회 테스트 중...`);
            
            const taskDetailRes = await axios.get(`${BASE_URL}/macro/tasks/${taskId}`);
            assertEqual(taskDetailRes.status, 200, '작업 상세 조회 상태 코드');
            assert(taskDetailRes.data.success, '작업 상세 조회 성공 플래그');
            assert(taskDetailRes.data.data.task, '작업 정보 존재');
            assert(Array.isArray(taskDetailRes.data.data.executionLogs), '실행 로그 배열 존재');
            
            const task = taskDetailRes.data.data.task;
            assertEqual(task.id, taskId, '작업 ID 일치');
            assert(['scheduled', 'running', 'completed', 'failed', 'cancelled'].includes(task.status), '유효한 작업 상태');
            
            log(`작업 상태: ${task.status}`, 'info');
            log(`작업 URL: ${task.target_url}`, 'info');
        }
        
        // 4.4 작업 취소 테스트 (마지막 작업만)
        if (taskIds.length > 0) {
            const cancelTaskId = taskIds[taskIds.length - 1];
            log(`작업 ${cancelTaskId} 취소 테스트 중...`);
            
            const cancelRes = await axios.delete(`${BASE_URL}/macro/tasks/${cancelTaskId}`);
            assertEqual(cancelRes.status, 200, '작업 취소 상태 코드');
            assert(cancelRes.data.success, '작업 취소 성공 플래그');
            
            log(`작업 ${cancelTaskId} 취소됨`, 'info');
            
            // 취소된 작업 상태 확인
            await delay(1000);
            const canceledTaskRes = await axios.get(`${BASE_URL}/macro/tasks/${cancelTaskId}`);
            if (canceledTaskRes.status === 200) {
                assertEqual(canceledTaskRes.data.data.task.status, 'cancelled', '작업 상태가 cancelled로 변경');
            }
        }
        
    } catch (error) {
        log(`작업 관리 테스트 실패: ${error.response?.data?.error || error.message}`, 'error');
        testResults.failed++;
    }
}

async function testStatsAndMonitoring() {
    log('\n=== 5. 통계 및 모니터링 테스트 ===', 'info');
    
    try {
        // 5.1 실행 통계 조회
        log('실행 통계 조회 테스트 중...');
        const statsRes = await axios.get(`${BASE_URL}/macro/stats?days=7`);
        assertEqual(statsRes.status, 200, '통계 조회 상태 코드');
        assert(statsRes.data.success, '통계 조회 성공 플래그');
        assert(statsRes.data.data.summary, '통계 요약 정보 존재');
        assert(Array.isArray(statsRes.data.data.byMacroType), '매크로 타입별 통계 배열');
        
        const stats = statsRes.data.data.summary;
        log(`총 실행 횟수: ${stats.total_executions}`, 'info');
        log(`성공률: ${stats.success_rate}`, 'info');
        log(`평균 응답 시간: ${Math.round(stats.avg_response_time || 0)}ms`, 'info');
        
        // 5.2 시스템 모니터링
        log('시스템 모니터링 조회 테스트 중...');
        const monitorRes = await axios.get(`${BASE_URL}/macro/monitor`);
        assertEqual(monitorRes.status, 200, '모니터링 조회 상태 코드');
        assert(monitorRes.data.success, '모니터링 조회 성공 플래그');
        assert(monitorRes.data.data.systemLoad, '시스템 로드 정보 존재');
        
        const monitoring = monitorRes.data.data;
        log(`시스템 상태: ${monitoring.status}`, 'info');
        log(`실행중 작업: ${monitoring.systemLoad.runningTasks}개`, 'info');
        log(`대기중 작업: ${monitoring.systemLoad.scheduledTasks}개`, 'info');
        log(`최근 실행: ${monitoring.systemLoad.recentExecutions}회`, 'info');
        log(`현재 성공률: ${monitoring.systemLoad.successRate}`, 'info');
        
        // 5.3 관리자 기능 테스트
        log('관리자 기능 테스트 중...');
        
        // 예약된 작업 수동 체크
        const manualCheckRes = await axios.post(`${BASE_URL}/admin/cron-execute/scheduled-check`);
        assertEqual(manualCheckRes.status, 200, '수동 작업 체크 상태 코드');
        assert(manualCheckRes.data.success, '수동 작업 체크 성공 플래그');
        
        log(`수동 체크로 실행된 작업: ${manualCheckRes.data.data.executedCount}개`, 'info');
        
        // 시스템 모니터링 수동 실행
        const manualMonitorRes = await axios.post(`${BASE_URL}/admin/cron-execute/monitoring`);
        assertEqual(manualMonitorRes.status, 200, '수동 모니터링 상태 코드');
        assert(manualMonitorRes.data.success, '수동 모니터링 성공 플래그');
        
    } catch (error) {
        log(`통계 및 모니터링 테스트 실패: ${error.response?.data?.error || error.message}`, 'error');
        testResults.failed++;
    }
}

async function testErrorHandling() {
    log('\n=== 6. 에러 처리 테스트 ===', 'info');
    
    try {
        // 6.1 사용자 동의 없음
        log('사용자 동의 없음 에러 테스트 중...');
        try {
            await axios.post(`${BASE_URL}/macro/execute`, {
                targetUrl: 'https://httpbin.org/get',
                macroType: 'get',
                userConsent: false
            });
            assert(false, '사용자 동의 없음 시 에러 발생해야 함');
        } catch (error) {
            assertEqual(error.response?.status, 400, '사용자 동의 없음 400 에러');
            assert(error.response?.data?.error?.includes('동의'), '동의 관련 에러 메시지');
        }
        
        // 6.2 잘못된 URL
        log('잘못된 URL 에러 테스트 중...');
        try {
            await axios.post(`${BASE_URL}/macro/execute`, {
                targetUrl: 'invalid-url-format',
                macroType: 'get',
                userConsent: true
            });
            assert(false, '잘못된 URL 시 에러 발생해야 함');
        } catch (error) {
            assertEqual(error.response?.status, 400, '잘못된 URL 400 에러');
        }
        
        // 6.3 과거 시간 예약
        log('과거 시간 예약 에러 테스트 중...');
        try {
            await axios.post(`${BASE_URL}/macro/schedule`, {
                targetUrl: 'https://httpbin.org/get',
                targetTime: '2020-01-01T00:00:00.000Z',
                macroType: 'get',
                userConsent: true
            });
            assert(false, '과거 시간 예약 시 에러 발생해야 함');
        } catch (error) {
            assertEqual(error.response?.status, 400, '과거 시간 예약 400 에러');
        }
        
        // 6.4 잘못된 매크로 타입
        log('잘못된 매크로 타입 에러 테스트 중...');
        try {
            await axios.post(`${BASE_URL}/macro/execute`, {
                targetUrl: 'https://httpbin.org/get',
                macroType: 'invalid-type',
                userConsent: true
            });
            assert(false, '잘못된 매크로 타입 시 에러 발생해야 함');
        } catch (error) {
            assertEqual(error.response?.status, 400, '잘못된 매크로 타입 400 에러');
        }
        
        // 6.5 존재하지 않는 작업 조회
        log('존재하지 않는 작업 조회 에러 테스트 중...');
        try {
            await axios.get(`${BASE_URL}/macro/tasks/99999`);
            assert(false, '존재하지 않는 작업 조회 시 에러 발생해야 함', true);
        } catch (error) {
            assert([404, 403].includes(error.response?.status), '존재하지 않는 작업 404 또는 403 에러', true);
        }
        
        // 6.6 범위를 벗어난 페이지네이션
        log('잘못된 페이지네이션 테스트 중...');
        try {
            await axios.get(`${BASE_URL}/macro/tasks?page=0&limit=200`);
            assert(false, '잘못된 페이지네이션 시 에러 발생해야 함', true);
        } catch (error) {
            assertEqual(error.response?.status, 400, '잘못된 페이지네이션 400 에러', true);
        }
        
    } catch (error) {
        log(`에러 처리 테스트 실패: ${error.message}`, 'error');
        testResults.failed++;
    }
}

async function testPerformance() {
    log('\n=== 7. 성능 테스트 ===', 'info');
    
    try {
        const performanceTests = [
            {
                name: '헬스체크 응답 속도',
                request: () => axios.get(`${BASE_URL}/health/macro`),
                maxTime: 1000
            },
            {
                name: '즉시 실행 응답 속도',
                request: () => axios.post(`${BASE_URL}/macro/execute`, {
                    targetUrl: 'https://httpbin.org/get',
                    macroType: 'get',
                    userConsent: true,
                    settings: { timeout: 5000 }
                }),
                maxTime: 8000
            },
            {
                name: '작업 목록 조회 속도',
                request: () => axios.get(`${BASE_URL}/macro/tasks?limit=10`),
                maxTime: 2000
            },
            {
                name: '통계 조회 속도',
                request: () => axios.get(`${BASE_URL}/macro/stats?days=1`),
                maxTime: 3000
            }
        ];
        
        for (const test of performanceTests) {
            const startTime = Date.now();
            try {
                await test.request();
                const responseTime = Date.now() - startTime;
                
                assert(responseTime <= test.maxTime, 
                    `${test.name}: ${responseTime}ms <= ${test.maxTime}ms`);
                
                log(`${test.name}: ${responseTime}ms`, 'info');
            } catch (error) {
                const responseTime = Date.now() - startTime;
                log(`${test.name} 실패 (${responseTime}ms): ${error.message}`, 'warning');
                testResults.warnings++;
            }
        }
        
    } catch (error) {
        log(`성능 테스트 실패: ${error.message}`, 'error');
        testResults.failed++;
    }
}

async function testAdvancedFeatures() {
    log('\n=== 8. 고급 기능 테스트 ===', 'info');
    
    try {
        // 8.1 배치 처리 테스트 (여러 매크로 동시 예약)
        log('배치 매크로 예약 테스트 중...');
        const batchPromises = [];
        const batchTargetTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        
        for (let i = 0; i < 3; i++) {
            const batchData = {
                targetUrl: `https://httpbin.org/delay/${i + 1}`,
                targetTime: batchTargetTime,
                macroType: 'get',
                userConsent: true,
                settings: {
                    timeout: 8000,
                    headers: {
                        'X-Batch-Index': i.toString()
                    }
                }
            };
            
            batchPromises.push(axios.post(`${BASE_URL}/macro/schedule`, batchData));
        }
        
        const batchResults = await Promise.all(batchPromises);
        assert(batchResults.every(res => res.status === 200), '배치 예약 모두 성공');
        
        const batchTaskIds = batchResults.map(res => res.data.data.taskId);
        testResults.createdTaskIds.push(...batchTaskIds);
        
        log(`배치 예약 성공: ${batchTaskIds.length}개 작업`, 'info');
        
        // 8.2 동시 즉시 실행 테스트
        log('동시 즉시 실행 테스트 중...');
        const concurrentPromises = [];
        
        for (let i = 0; i < 5; i++) {
            const concurrentData = {
                targetUrl: 'https://httpbin.org/get',
                macroType: 'get',
                userConsent: true,
                settings: {
                    timeout: 5000,
                    headers: {
                        'X-Concurrent-Index': i.toString(),
                        'X-Concurrent-Timestamp': new Date().toISOString()
                    }
                }
            };
            
            concurrentPromises.push(axios.post(`${BASE_URL}/macro/execute`, concurrentData));
        }
        
        const concurrentResults = await Promise.all(concurrentPromises);
        assert(concurrentResults.every(res => res.status === 200), '동시 실행 모두 성공');
        assert(concurrentResults.every(res => res.data.data.executionResult.success), '동시 실행 결과 모두 성공');
        
        log(`동시 실행 성공: ${concurrentResults.length}개 요청`, 'info');
        
        // 8.3 복잡한 설정 테스트
        log('복잡한 설정 매크로 테스트 중...');
        const complexData = {
            targetUrl: 'https://httpbin.org/post',
            macroType: 'post',
            userConsent: true,
            settings: {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Custom-Header': 'complex-test',
                    'Authorization': 'Bearer test-token',
                    'User-Agent': 'Navism-Test-Complex/1.0'
                },
                body: {
                    complexData: {
                        nested: {
                            array: [1, 2, 3],
                            object: {
                                key1: 'value1',
                                key2: true,
                                key3: null
                            }
                        }
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        testType: 'complex-settings',
                        version: '1.0'
                    }
                }
            }
        };
        
        const complexRes = await axios.post(`${BASE_URL}/macro/execute`, complexData);
        assertEqual(complexRes.status, 200, '복잡한 설정 매크로 상태 코드');
        assert(complexRes.data.data.executionResult.success, '복잡한 설정 매크로 실행 성공');
        
        log('복잡한 설정 매크로 실행 성공', 'info');
        
    } catch (error) {
        log(`고급 기능 테스트 실패: ${error.response?.data?.error || error.message}`, 'error');
        testResults.failed++;
    }
}

async function cleanupTestData() {
    log('\n=== 9. 테스트 데이터 정리 ===', 'info');
    
    try {
        let canceledCount = 0;
        
        for (const taskId of testResults.createdTaskIds) {
            try {
                const cancelRes = await axios.delete(`${BASE_URL}/macro/tasks/${taskId}`);
                if (cancelRes.status === 200) {
                    canceledCount++;
                }
            } catch (error) {
                // 이미 취소되었거나 존재하지 않는 경우 무시
                log(`작업 ${taskId} 정리 실패 (이미 처리됨): ${error.response?.status}`, 'warning');
            }
        }
        
        log(`${canceledCount}개의 테스트 작업이 정리되었습니다`, 'info');
        
        // 수동 정리 실행
        const cleanupRes = await axios.post(`${BASE_URL}/admin/cron-execute/cleanup`);
        if (cleanupRes.status === 200) {
            log('시스템 정리 작업 실행됨', 'info');
        }
        
    } catch (error) {
        log(`테스트 데이터 정리 실패: ${error.message}`, 'warning');
        testResults.warnings++;
    }
}

// 메인 테스트 실행 함수
async function runAllTests() {
    console.log('🧪 매크로 API 종합 테스트 시작');
    console.log('='.repeat(60));
    console.log(`테스트 시작 시간: ${new Date().toLocaleString()}`);
    console.log(`베이스 URL: ${BASE_URL}`);
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    let taskIds = [];
    
    try {
        // 순차적 테스트 실행
        await testBasicConnectivity();
        await testImmediateExecution();
        taskIds = await testMacroScheduling();
        await testTaskManagement(taskIds);
        await testStatsAndMonitoring();
        await testErrorHandling();
        await testPerformance();
        await testAdvancedFeatures();
        
        // 테스트 데이터 정리
        await cleanupTestData();
        
    } catch (error) {
        log(`치명적 테스트 오류: ${error.message}`, 'error');
        testResults.failed++;
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // 최종 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📊 테스트 결과 요약');
    console.log('='.repeat(60));
    
    const total = testResults.passed + testResults.failed + testResults.warnings;
    const successRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : '0.0';
    
    console.log(`✅ 통과: ${testResults.passed}`);
    console.log(`❌ 실패: ${testResults.failed}`);
    console.log(`⚠️ 경고: ${testResults.warnings}`);
    console.log(`📈 성공률: ${successRate}%`);
    console.log(`⏱️ 소요 시간: ${duration}초`);
    console.log(`🗂️ 생성된 작업: ${testResults.createdTaskIds.length}개`);
    console.log(`🕐 종료 시간: ${new Date().toLocaleString()}`);
    
    // 실패한 테스트 상세 정보
    if (testResults.errors.length > 0) {
        console.log('\n❌ 실패한 테스트들:');
        testResults.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }
    
    // 권장사항
    console.log('\n💡 권장사항:');
    if (testResults.failed === 0) {
        console.log('   🎉 모든 테스트가 성공했습니다! 매크로 시스템이 정상 작동합니다.');
    } else if (testResults.failed < 5) {
        console.log('   ⚠️ 일부 테스트가 실패했습니다. 서버 로그를 확인해보세요.');
    } else {
        console.log('   🚨 다수의 테스트가 실패했습니다. 시스템 설정을 점검해주세요.');
    }
    
    if (testResults.warnings > 0) {
        console.log(`   ⚠️ ${testResults.warnings}개의 경고가 있습니다. 성능이나 연결을 확인해보세요.`);
    }
    
    // 생산성 팁
    console.log('\n🔧 추가 테스트 명령어:');
    console.log('   curl http://localhost:3001/health');
    console.log('   curl http://localhost:3001/api/health/macro');
    console.log('   curl http://localhost:3001/api/macro/monitor');
    console.log('   curl -X POST http://localhost:3001/api/admin/cron-execute/scheduled-check');
    
    console.log('\n🏁 테스트 완료!');
    
    // 종료 코드 설정
    const exitCode = testResults.failed > 0 ? 1 : 0;
    process.exit(exitCode);
}

// 개별 테스트 실행 함수들
async function runQuickTest() {
    console.log('🚀 빠른 테스트 실행...');
    await testBasicConnectivity();
    await testImmediateExecution();
    console.log('빠른 테스트 완료!');
}

async function runConnectionTest() {
    console.log('🔌 연결 테스트 실행...');
    await testBasicConnectivity();
    console.log('연결 테스트 완료!');
}

async function runPerformanceTestOnly() {
    console.log('⚡ 성능 테스트 실행...');
    await testPerformance();
    console.log('성능 테스트 완료!');
}

// 명령행 인자 처리
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'quick':
        runQuickTest();
        break;
    case 'connection':
        runConnectionTest();
        break;
    case 'performance':
        runPerformanceTestOnly();
        break;
    case 'help':
        console.log('사용법: node test_macro_api.js [command]');
        console.log('');
        console.log('Commands:');
        console.log('  (없음)      - 전체 테스트 실행');
        console.log('  quick      - 빠른 테스트 (연결 + 즉시실행)');
        console.log('  connection - 연결 테스트만');
        console.log('  performance - 성능 테스트만');
        console.log('  help       - 도움말');
        console.log('');
        console.log('예시:');
        console.log('  node test_macro_api.js');
        console.log('  node test_macro_api.js quick');
        console.log('  node test_macro_api.js performance');
        break;
    default:
        runAllTests();
}

// 모듈 export
module.exports = {
    runAllTests,
    runQuickTest,
    runConnectionTest,
    runPerformanceTestOnly,
    testBasicConnectivity,
    testImmediateExecution,
    testMacroScheduling,
    testTaskManagement,
    testStatsAndMonitoring,
    testErrorHandling,
    testPerformance,
    testAdvancedFeatures
};