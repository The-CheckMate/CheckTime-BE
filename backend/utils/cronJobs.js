// backend/utils/cronJobs.js
const cron = require('node-cron');
const MacroService = require('../services/MacroService');

class MacroCronJobs {
    constructor() {
        this.macroService = new MacroService();
        this.jobs = new Map();
        this.isRunning = false;
    }

    /**
     * 모든 크론잡 시작
     */
    startAllJobs() {
        if (this.isRunning) {
            console.log('크론잡이 이미 실행 중입니다.');
            return;
        }

        console.log('🚀 매크로 크론잡 시작...');

        // 1. 예약된 매크로 실행 체크 (매분마다)
        this.startScheduledTaskChecker();

        // 2. 만료된 작업 정리 (매일 자정)
        this.startCleanupJob();

        // 3. 시스템 상태 모니터링 (매 5분마다)
        this.startSystemMonitoring();

        // 4. 통계 집계 (매일 새벽 2시)
        this.startStatsAggregation();

        this.isRunning = true;
        console.log('✅ 모든 매크로 크론잡이 시작되었습니다.');
    }

    /**
     * 모든 크론잡 중지
     */
    stopAllJobs() {
        console.log('🛑 매크로 크론잡 중지 중...');

        this.jobs.forEach((job, name) => {
            if (job) {
                job.stop();
                console.log(`- ${name} 작업 중지됨`);
            }
        });

        this.jobs.clear();
        this.isRunning = false;
        console.log('✅ 모든 매크로 크론잡이 중지되었습니다.');
    }

    /**
 * 1. 예약된 매크로 작업 실행 체크 (매분마다)
 */
    startScheduledTaskChecker() {
        const job = cron.schedule('* * * * *', async () => {
            try {
                console.log('⏰ 예약된 매크로 작업 체크 중...');
                
                const results = await this.macroService.checkScheduledTasks();
                
                if (results.length > 0) {
                    const successCount = results.filter(r => r.success).length;
                    const failCount = results.length - successCount;
                    
                    console.log(`✅ ${successCount}개 매크로 성공, ❌ ${failCount}개 매크로 실패`);
                    
                    // 실패한 작업들 로그
                    results.filter(r => !r.success).forEach(result => {
                        console.error(`❌ Task ${result.taskId} 실패: ${result.error}`);
                    });
                } else {
                    console.log('📝 실행할 예약된 작업이 없습니다.');
                }
                
            } catch (error) {
                console.error('❌ 예약된 작업 체크 오류:', error.message);
            }
        }, {
            scheduled: false,
            timezone: "Asia/Seoul"
        });

        // job 객체에 추가 속성 설정
        job.running = false;
        
        this.jobs.set('scheduledTaskChecker', job);
        job.start();
        job.running = true; // start 후에 running을 true로 설정
        
        console.log('✅ 예약된 작업 체크 크론잡 시작됨 (매분 실행)');
    }


/**
 * 2. 만료된 작업 정리 (매일 자정)
 */
    startCleanupJob() {
        const job = cron.schedule('0 0 * * *', async () => {
            try {
                console.log('🧹 만료된 작업 정리 시작...');
                
                const result = await this.macroService.cleanupExpiredTasks(30);
                
                console.log(`🗑️ 정리 완료: ${result.deletedTasks}개 작업, ${result.deletedLogs}개 로그`);
                
                // 추가로 DB 최적화 (VACUUM ANALYZE)
                if (result.deletedTasks > 0 || result.deletedLogs > 0) {
                    await this.optimizeDatabase();
                }
                
            } catch (error) {
                console.error('❌ 작업 정리 오류:', error.message);
            }
        }, {
            scheduled: false,
            timezone: "Asia/Seoul"
        });

        job.running = false;
        
        this.jobs.set('cleanupJob', job);
        job.start();
        job.running = true;
        
        console.log('✅ 작업 정리 크론잡 시작됨 (매일 자정 실행)');
    }

    /**
     * 3. 시스템 상태 모니터링 (매 5분마다)
     */
    startSystemMonitoring() {
        const job = cron.schedule('*/5 * * * *', async () => {
            try {
                const monitoring = await this.macroService.getSystemMonitoring();
                
                // 시스템 부하가 높으면 경고
                if (monitoring.status === 'high_load') {
                    console.warn('⚠️ 시스템 부하 높음:', {
                        runningTasks: monitoring.systemLoad.runningTasks,
                        scheduledTasks: monitoring.systemLoad.scheduledTasks,
                        recentExecutions: monitoring.systemLoad.recentExecutions
                    });
                    
                    // 필요시 알림 서비스 호출
                    await this.sendHighLoadAlert(monitoring);
                }
                
                // 성공률이 낮으면 경고
                const successRate = parseFloat(monitoring.systemLoad.successRate);
                if (successRate < 70) {
                    console.warn('⚠️ 매크로 성공률 낮음:', monitoring.systemLoad.successRate);
                }
                
                // 정상 상태일 때는 간단한 로그만
                if (monitoring.status === 'healthy') {
                    console.log(`💚 시스템 정상 - 실행중: ${monitoring.systemLoad.runningTasks}, 대기중: ${monitoring.systemLoad.scheduledTasks}`);
                }
                
            } catch (error) {
                console.error('❌ 시스템 모니터링 오류:', error.message);
            }
        }, {
            scheduled: false,
            timezone: "Asia/Seoul"
        });

        job.running = false;
        
        this.jobs.set('systemMonitoring', job);
        job.start();
        job.running = true;
        
        console.log('✅ 시스템 모니터링 크론잡 시작됨 (5분마다 실행)');
    }

    /**
     * 4. 통계 집계 (매일 새벽 2시)
     */
    startStatsAggregation() {
        const job = cron.schedule('0 2 * * *', async () => {
            try {
                console.log('📊 일별 통계 집계 시작...');
                
                // 어제 날짜 통계 집계
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                const stats = await this.macroService.getExecutionStats(null, 1);
                
                console.log('📈 어제 통계:', {
                    totalExecutions: stats.summary.total_executions,
                    successRate: stats.summary.success_rate,
                    avgResponseTime: Math.round(stats.summary.avg_response_time) + 'ms'
                });
                
                // 주간 통계도 계산 (매주 월요일)
                if (yesterday.getDay() === 1) { // 월요일
                    await this.generateWeeklyReport();
                }
                
            } catch (error) {
                console.error('❌ 통계 집계 오류:', error.message);
            }
        }, {
            scheduled: false,
            timezone: "Asia/Seoul"
        });

        job.running = false;
        
        this.jobs.set('statsAggregation', job);
        job.start();
        job.running = true;
        
        console.log('✅ 통계 집계 크론잡 시작됨 (매일 새벽 2시 실행)');
    }

    /**
     * 5. 데드락 방지 및 긴급 복구 (매 30분마다)
     */
    startEmergencyRecovery() {
        const job = cron.schedule('*/30 * * * *', async () => {
            try {
                // 너무 오래 실행 중인 작업 찾기 (30분 초과)
                const stuckTasks = await this.macroService.pool.query(`
                    SELECT id, target_url, executed_at
                    FROM macro_tasks 
                    WHERE status = 'running' 
                    AND executed_at < NOW() - INTERVAL '30 minutes'
                `);

                if (stuckTasks.rows.length > 0) {
                    console.warn(`⚠️ 멈춘 작업 ${stuckTasks.rows.length}개 발견, 복구 중...`);
                    
                    for (const task of stuckTasks.rows) {
                        await this.macroService.pool.query(`
                            UPDATE macro_tasks 
                            SET status = 'failed', 
                                error_message = '타임아웃으로 인한 자동 실패 처리'
                            WHERE id = $1
                        `, [task.id]);
                        
                        console.log(`🔧 Task ${task.id} 복구됨: ${task.target_url}`);
                    }
                }

                // 메모리 사용량 체크 및 가비지 컬렉션
                const memUsage = process.memoryUsage();
                const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
                
                if (memUsageMB > 500) { // 500MB 초과시
                    console.warn(`⚠️ 메모리 사용량 높음: ${memUsageMB}MB`);
                    
                    if (global.gc) {
                        global.gc();
                        console.log('🧹 가비지 컬렉션 실행됨');
                    }
                }
                
            } catch (error) {
                console.error('❌ 긴급 복구 오류:', error.message);
            }
        }, {
            scheduled: false,
            timezone: "Asia/Seoul"
        });

        this.jobs.set('emergencyRecovery', job);
        job.start();
        console.log('✅ 긴급 복구 크론잡 시작됨 (30분마다 실행)');
    }

    /**
     * 데이터베이스 최적화
     */
    async optimizeDatabase() {
        try {
            console.log('🔧 데이터베이스 최적화 중...');
            
            // PostgreSQL VACUUM ANALYZE 실행
            await this.macroService.pool.query('VACUUM ANALYZE macro_tasks');
            await this.macroService.pool.query('VACUUM ANALYZE macro_execution_logs');
            
            console.log('✅ 데이터베이스 최적화 완료');
            
        } catch (error) {
            console.error('❌ 데이터베이스 최적화 오류:', error.message);
        }
    }

    /**
     * 높은 부하 알림
     */
    async sendHighLoadAlert(monitoring) {
        try {
            // 실제 환경에서는 이메일, 슬랙, 디스코드 등으로 알림 전송
            console.error('🚨 HIGH LOAD ALERT 🚨', {
                timestamp: monitoring.timestamp,
                runningTasks: monitoring.systemLoad.runningTasks,
                scheduledTasks: monitoring.systemLoad.scheduledTasks,
                recentExecutions: monitoring.systemLoad.recentExecutions,
                successRate: monitoring.systemLoad.successRate,
                avgResponseTime: monitoring.systemLoad.avgResponseTime
            });

            // TODO: 실제 알림 서비스 구현
            // await emailService.sendAlert(monitoring);
            // await slackService.sendAlert(monitoring);
            
        } catch (error) {
            console.error('❌ 알림 전송 오류:', error.message);
        }
    }

    /**
     * 주간 리포트 생성
     */
    async generateWeeklyReport() {
        try {
            console.log('📋 주간 리포트 생성 중...');
            
            const weeklyStats = await this.macroService.getExecutionStats(null, 7);
            
            const report = {
                period: '지난 7일',
                summary: weeklyStats.summary,
                topUrls: await this.getTopUrls(7),
                performanceByType: weeklyStats.byMacroType,
                generatedAt: new Date().toISOString()
            };

            console.log('📊 주간 리포트:', {
                totalExecutions: report.summary.total_executions,
                successRate: report.summary.success_rate,
                avgResponseTime: Math.round(report.summary.avg_response_time) + 'ms',
                topUrlCount: report.topUrls.length
            });

            // TODO: 리포트를 파일로 저장하거나 이메일로 전송
            // await this.saveWeeklyReport(report);
            
        } catch (error) {
            console.error('❌ 주간 리포트 생성 오류:', error.message);
        }
    }

    /**
     * 인기 URL 상위 10개 조회
     */
    async getTopUrls(days = 7) {
        try {
            const result = await this.macroService.pool.query(`
                SELECT 
                    target_url,
                    COUNT(*) as execution_count,
                    COUNT(CASE WHEN success THEN 1 END) as success_count,
                    AVG(response_time) as avg_response_time
                FROM macro_execution_logs 
                WHERE executed_at > CURRENT_TIMESTAMP - INTERVAL '${days} days'
                GROUP BY target_url
                ORDER BY execution_count DESC
                LIMIT 10
            `);

            return result.rows;
        } catch (error) {
            console.error('❌ 인기 URL 조회 오류:', error.message);
            return [];
        }
    }


/**
 * 크론잡 상태 조회
 */
getJobStatus() {
    const status = {};
    
    this.jobs.forEach((job, name) => {
        try {
            // node-cron의 실제 메소드들 사용
            const isRunning = job.running || false;
            let nextExecution = null;
            
            // 다음 실행 시간 계산 (선택적)
            try {
                if (job.nextDate && typeof job.nextDate === 'function') {
                    nextExecution = job.nextDate().toISOString();
                }
            } catch (e) {
                // nextDate 메소드가 없거나 에러가 발생하면 무시
                nextExecution = null;
            }
            
            status[name] = {
                running: isRunning,
                nextExecution: nextExecution,
                status: isRunning ? 'active' : 'inactive'
            };
        } catch (error) {
            // 개별 job 상태 확인 실패시 기본값
            status[name] = {
                running: false,
                nextExecution: null,
                status: 'error',
                error: error.message
            };
        }
    });

    return {
        isRunning: this.isRunning,
        totalJobs: this.jobs.size,
        activeJobs: Object.values(status).filter(job => job.running).length,
        jobs: status,
        timestamp: new Date().toISOString()
    };
}

    /**
     * 특정 작업 재시작
     */
    restartJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            try {
                job.stop();
                job.running = false;
                
                setTimeout(() => {
                    job.start();
                    job.running = true;
                    console.log(`🔄 ${jobName} 작업이 재시작되었습니다.`);
                }, 1000);
                
                return true;
            } catch (error) {
                console.error(`❌ ${jobName} 재시작 실패:`, error.message);
                return false;
            }
        } else {
            console.error(`❌ ${jobName} 작업을 찾을 수 없습니다.`);
            return false;
        }
    }

    /**
     * 프로세스 종료시 정리 작업
     */
    gracefulShutdown() {
        console.log('🛑 매크로 크론잡 시스템 종료 중...');
        
        this.stopAllJobs();
        
        // DB 연결 종료
        if (this.macroService && this.macroService.pool) {
            this.macroService.pool.end();
        }
        
        console.log('✅ 매크로 크론잡 시스템 정상 종료됨');
    }
}

// 싱글톤 인스턴스 생성
const macroCronJobs = new MacroCronJobs();

// 프로세스 종료 시그널 처리
process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT 신호 수신, 크론잡 종료 중...');
    macroCronJobs.gracefulShutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM 신호 수신, 크론잡 종료 중...');
    macroCronJobs.gracefulShutdown();
    process.exit(0);
});

// 예외 처리
process.on('uncaughtException', (error) => {
    console.error('❌ 처리되지 않은 예외:', error);
    macroCronJobs.gracefulShutdown();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 처리되지 않은 Promise 거부:', reason);
    // 크론잡은 계속 실행하되 에러만 로그
});

module.exports = macroCronJobs;

// 직접 실행시 크론잡 시작
if (require.main === module) {
    console.log('🚀 매크로 크론잡 단독 실행...');
    
    // 환경 변수 체크
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.');
        process.exit(1);
    }
    
    // 모든 크론잡 시작
    macroCronJobs.startAllJobs();
    
    // 추가 작업들도 시작 (선택적)
    macroCronJobs.startEmergencyRecovery();
    
    console.log('✅ 매크로 크론잡 시스템이 시작되었습니다.');
    console.log('종료하려면 Ctrl+C를 누르세요.');
}