// live_macro_test.js - 실시간 매크로 동작 테스트
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/macro';
let testTaskId = null;

// 컬러 로그
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
        success: '\x1b[32m✅',
        error: '\x1b[31m❌', 
        warning: '\x1b[33m⚠️',
        info: '\x1b[36mℹ️',
        waiting: '\x1b[35m⏳',
        reset: '\x1b[0m'
    };
    console.log(`${colors[type]} [${timestamp}] ${message}${colors.reset}`);
}

// 딜레이 함수
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 현재 시간부터 N초 후 ISO 문자열 생성
function getTimeAfterSeconds(seconds) {
    return new Date(Date.now() + seconds * 1000).toISOString();
}

// 1. 짧은 시간 매크로 예약 (30초 후)
async function scheduleShortTermMacro() {
    log('=== 30초 후 매크로 예약 테스트 ===', 'info');
    
    const targetTime = getTimeAfterSeconds(30);
    log(`목표 시간: ${targetTime} (30초 후)`);
    
    try {
        const scheduleData = {
            targetUrl: 'https://httpbin.org/get',
            targetTime: targetTime,
            macroType: 'get',
            userConsent: true,
            settings: {
                timeout: 8000,
                headers: {
                    'X-Test-Type': 'live-test',
                    'X-Test-Time': new Date().toISOString(),
                    'X-Test-ID': Math.random().toString(36).substr(2, 9)
                }
            }
        };
        
        const response = await axios.post(`${BASE_URL}/schedule`, scheduleData);
        
        if (response.data.success) {
            testTaskId = response.data.data.taskId;
            log(`✅ 예약 성공! Task ID: ${testTaskId}`, 'success');
            log(`최적 실행 시간: ${response.data.data.optimalTiming.optimalRefreshTime}`, 'info');
            log(`네트워크 지연: ${response.data.data.optimalTiming.networkDelay}ms`, 'info');
            log(`서버 처리: ${response.data.data.optimalTiming.serverProcessing}ms`, 'info');
            return testTaskId;
        } else {
            log('❌ 예약 실패: ' + response.data.error, 'error');
            return null;
        }
    } catch (error) {
        log('❌ 예약 요청 실패: ' + (error.response?.data?.error || error.message), 'error');
        return null;
    }
}

// 2. 작업 상태 실시간 모니터링
async function monitorTaskStatus(taskId, maxWaitMinutes = 2) {
    log('=== 작업 상태 실시간 모니터링 ===', 'info');
    
    const startTime = Date.now();
    const maxWaitTime = maxWaitMinutes * 60 * 1000;
    let lastStatus = 'unknown';
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            const response = await axios.get(`${BASE_URL}/tasks/${taskId}`);
            
            if (response.data.success) {
                const task = response.data.data.task;
                const currentStatus = task.status;
                
                // 상태가 변경되었을 때만 로그
                if (currentStatus !== lastStatus) {
                    log(`📊 작업 상태 변경: ${lastStatus} → ${currentStatus}`, 'info');
                    lastStatus = currentStatus;
                    
                    if (currentStatus === 'completed') {
                        log('🎉 작업 완료!', 'success');
                        log(`실행 시간: ${task.executed_at}`, 'info');
                        
                        if (task.result_data) {
                            // 안전한 JSON 파싱
                            let result;
                            try {
                                if (typeof task.result_data === 'string') {
                                    result = JSON.parse(task.result_data);
                                } else {
                                    result = task.result_data;  // 이미 객체인 경우
                                }
                                
                                log(`응답 시간: ${result.responseTime}ms`, 'info');
                                log(`상태 코드: ${result.statusCode}`, 'info');
                                log(`성공 여부: ${result.success}`, result.success ? 'success' : 'error');
                            } catch (parseError) {
                                log(`결과 데이터 파싱 실패: ${parseError.message}`, 'warning');
                                log(`원본 데이터 타입: ${typeof task.result_data}`, 'info');
                            }
                        }
                        
                        // 실행 로그도 확인
                        const logs = response.data.data.executionLogs;
                        if (logs && logs.length > 0) {
                            log(`실행 로그: ${logs.length}개 항목`, 'info');
                            logs.forEach((logEntry, index) => {
                                log(`  ${index + 1}. ${logEntry.executed_at} - 성공: ${logEntry.success}, 응답시간: ${logEntry.response_time}ms`, 'info');
                            });
                        }
                        
                        return true;
                    } else if (currentStatus === 'failed') {
                        log('❌ 작업 실패!', 'error');
                        if (task.error_message) {
                            log(`실패 원인: ${task.error_message}`, 'error');
                        }
                        return false;
                    } else if (currentStatus === 'running') {
                        log('🏃‍♂️ 작업 실행 중...', 'waiting');
                    }
                }
                
                // scheduled 상태일 때는 실행까지 남은 시간 표시
                if (currentStatus === 'scheduled') {
                    const now = new Date();
                    const executionTime = new Date(task.optimal_refresh_time);
                    const remainingMs = executionTime.getTime() - now.getTime();
                    
                    if (remainingMs > 0) {
                        const remainingSeconds = Math.ceil(remainingMs / 1000);
                        log(`⏰ 실행까지 ${remainingSeconds}초 남음`, 'waiting');
                    } else {
                        log('⏰ 실행 시간이 지났는데 아직 scheduled 상태... 크론잡 확인 필요', 'warning');
                    }
                }
                
            } else {
                log('❌ 작업 상태 조회 실패: ' + response.data.error, 'error');
            }
            
        } catch (error) {
            log('❌ 작업 상태 조회 오류: ' + (error.response?.data?.error || error.message), 'error');
        }
        
        // 5초마다 체크
        await delay(5000);
    }
    
    log('⏰ 모니터링 시간 초과 (2분)', 'warning');
    return false;
}

// 3. 크론잡 상태 확인
async function checkCronJobStatus() {
    log('=== 크론잡 상태 확인 ===', 'info');
    
    try {
        const response = await axios.get('http://localhost:3001/api/admin/cron-status');
        
        if (response.data.success) {
            const cronData = response.data.data;
            log(`크론잡 실행 상태: ${cronData.isRunning ? '✅ 실행중' : '❌ 중지됨'}`, cronData.isRunning ? 'success' : 'error');
            log(`총 크론잡 수: ${cronData.totalJobs}`, 'info');
            log(`활성 크론잡 수: ${cronData.activeJobs}`, 'info');
            
            if (cronData.jobs) {
                Object.entries(cronData.jobs).forEach(([jobName, jobInfo]) => {
                    log(`  - ${jobName}: ${jobInfo.running ? '✅ 실행중' : '❌ 중지됨'}`, 'info');
                });
            }
            
            return cronData.isRunning;
        } else {
            log('❌ 크론잡 상태 조회 실패', 'error');
            return false;
        }
    } catch (error) {
        log('❌ 크론잡 상태 조회 오류: ' + (error.response?.data?.error || error.message), 'error');
        return false;
    }
}

// 4. 수동으로 크론잡 실행
async function manualExecuteCronJob() {
    log('=== 수동 크론잡 실행 ===', 'info');
    
    try {
        const response = await axios.post(`${BASE_URL}/check-scheduled`);
        
        if (response.data.success) {
            const executedCount = response.data.data.executedCount;
            log(`✅ 수동 실행 완료: ${executedCount}개 작업 처리됨`, 'success');
            
            if (response.data.data.results) {
                response.data.data.results.forEach((result, index) => {
                    log(`  ${index + 1}. Task ${result.taskId}: ${result.success ? '✅ 성공' : '❌ 실패'}`, result.success ? 'success' : 'error');
                });
            }
            
            return executedCount;
        } else {
            log('❌ 수동 실행 실패: ' + response.data.error, 'error');
            return 0;
        }
    } catch (error) {
        log('❌ 수동 실행 오류: ' + (error.response?.data?.error || error.message), 'error');
        return 0;
    }
}

// 5. 시스템 모니터링
async function checkSystemMonitoring() {
    log('=== 시스템 모니터링 ===', 'info');
    
    try {
        const response = await axios.get(`${BASE_URL}/monitor`);
        
        if (response.data.success) {
            const monitoring = response.data.data;
            log(`시스템 상태: ${monitoring.status}`, monitoring.status === 'healthy' ? 'success' : 'warning');
            log(`실행중 작업: ${monitoring.systemLoad.runningTasks}개`, 'info');
            log(`대기중 작업: ${monitoring.systemLoad.scheduledTasks}개`, 'info');
            log(`최근 실행: ${monitoring.systemLoad.recentExecutions}회`, 'info');
            log(`성공률: ${monitoring.systemLoad.successRate}`, 'info');
            log(`평균 응답시간: ${monitoring.systemLoad.avgResponseTime}ms`, 'info');
            
            return monitoring;
        } else {
            log('❌ 모니터링 조회 실패', 'error');
            return null;
        }
    } catch (error) {
        log('❌ 모니터링 조회 오류: ' + (error.response?.data?.error || error.message), 'error');
        return null;
    }
}

// 6. 즉시 실행 테스트 (비교군)
async function testImmediateExecution() {
    log('=== 즉시 실행 테스트 (비교군) ===', 'info');
    
    try {
        const executeData = {
            targetUrl: 'https://httpbin.org/get',
            macroType: 'get',
            userConsent: true,
            settings: {
                timeout: 8000,
                headers: {
                    'X-Test-Type': 'immediate-test',
                    'X-Test-Time': new Date().toISOString()
                }
            }
        };
        
        const startTime = Date.now();
        const response = await axios.post(`${BASE_URL}/execute`, executeData);
        const endTime = Date.now();
        
        if (response.data.success) {
            const result = response.data.data.executionResult;
            log(`✅ 즉시 실행 성공!`, 'success');
            log(`전체 소요시간: ${endTime - startTime}ms`, 'info');
            log(`HTTP 응답시간: ${result.responseTime}ms`, 'info');
            log(`상태 코드: ${result.statusCode}`, 'info');
            return true;
        } else {
            log('❌ 즉시 실행 실패', 'error');
            return false;
        }
    } catch (error) {
        log('❌ 즉시 실행 오류: ' + (error.response?.data?.error || error.message), 'error');
        return false;
    }
}

// 메인 테스트 함수
async function runLiveTest() {
    console.log('🚀 실시간 매크로 동작 테스트 시작');
    console.log('='.repeat(60));
    console.log(`시작 시간: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));
    
    // 1. 기본 연결 및 시스템 상태 확인
    await checkSystemMonitoring();
    const cronRunning = await checkCronJobStatus();
    
    if (!cronRunning) {
        log('⚠️ 크론잡이 실행되지 않고 있습니다. 수동 실행으로 테스트를 진행합니다.', 'warning');
    }
    
    // 2. 즉시 실행 테스트 (기준점)
    await testImmediateExecution();
    
    // 3. 30초 후 매크로 예약
    const taskId = await scheduleShortTermMacro();
    
    if (!taskId) {
        log('❌ 예약 실패로 테스트를 중단합니다.', 'error');
        return;
    }
    
    // 4. 실시간 모니터링 시작
    log('⏳ 30초 후 자동 실행을 기다리는 중... (2분간 모니터링)', 'waiting');
    
    // 5. 백그라운드에서 모니터링하면서 중간에 수동 실행도 시도
    const monitoringPromise = monitorTaskStatus(taskId, 2);
    
    // 35초 후에 수동 크론잡 실행 (크론잡이 안 돌고 있을 경우 대비)
    setTimeout(async () => {
        log('🔧 35초 경과 - 수동 크론잡 실행 시도', 'info');
        await manualExecuteCronJob();
    }, 35000);
    
    // 모니터링 완료까지 대기
    const success = await monitoringPromise;
    
    // 6. 최종 결과
    console.log('\n' + '='.repeat(60));
    console.log('📊 테스트 결과');
    console.log('='.repeat(60));
    
    if (success) {
        log('🎉 매크로 자동 실행 테스트 성공!', 'success');
        log('시스템이 정상적으로 동작하고 있습니다.', 'success');
    } else {
        log('❌ 매크로 자동 실행에 문제가 있습니다.', 'error');
        log('크론잡 설정이나 시스템 상태를 확인해주세요.', 'warning');
    }
    
    // 최종 시스템 상태 재확인
    await checkSystemMonitoring();
    
    console.log('\n🏁 실시간 테스트 완료!');
    console.log(`종료 시간: ${new Date().toLocaleString()}`);
}

// 간단한 테스트 (크론잡이 안 돌 때용)
async function runSimpleTest() {
    console.log('🔧 간단한 수동 테스트 시작');
    
    // 1. 5초 후 예약
    const targetTime = getTimeAfterSeconds(5);
    log(`5초 후 매크로 예약: ${targetTime}`);
    
    const scheduleData = {
        targetUrl: 'https://httpbin.org/get',
        targetTime: targetTime,
        macroType: 'get',
        userConsent: true
    };
    
    const scheduleRes = await axios.post(`${BASE_URL}/schedule`, scheduleData);
    const taskId = scheduleRes.data.data.taskId;
    log(`예약 완료: Task ${taskId}`);
    
    // 2. 10초 후 수동 실행
    await delay(10000);
    log('10초 경과 - 수동 크론잡 실행');
    
    const executeRes = await axios.post(`${BASE_URL}/check-scheduled`);
    log(`수동 실행 결과: ${executeRes.data.data.executedCount}개 작업 처리됨`);
    
    // 3. 결과 확인
    await delay(2000);
    const taskRes = await axios.get(`${BASE_URL}/tasks/${taskId}`);
    const task = taskRes.data.data.task;
    
    log(`최종 작업 상태: ${task.status}`);
    if (task.status === 'completed') {
        log('✅ 수동 테스트 성공!', 'success');
    } else {
        log('❌ 수동 테스트 실패', 'error');
    }
}

// 명령행 인자 처리
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'simple':
        runSimpleTest();
        break;
    case 'help':
        console.log('사용법: node live_macro_test.js [command]');
        console.log('');
        console.log('Commands:');
        console.log('  (없음)  - 전체 실시간 테스트 (30초 예약 + 2분 모니터링)');
        console.log('  simple - 간단한 수동 테스트 (5초 예약 + 수동 실행)');
        console.log('  help   - 도움말');
        break;
    default:
        runLiveTest();
}

module.exports = {
    runLiveTest,
    runSimpleTest,
    scheduleShortTermMacro,
    monitorTaskStatus,
    checkCronJobStatus,
    manualExecuteCronJob
};