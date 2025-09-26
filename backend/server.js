require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const server = http.createServer(app); // 이 부분이 빠져있었음!
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = 3001;

// 매크로 관련 모듈 import (라우트보다 먼저)
const macroRoutes = require('./routes/macroRoutes');
const macroCronJobs = require('./utils/cronJobs');

// 미들웨어 먼저 설정 (라우터 전에)
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 요청 로깅
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 라우트 등록
const timeRoutes = require("./routes/timeRoutes");
app.use("/api/time", timeRoutes);

const networkRoutes = require("./routes/networkRoutes");
app.use("/api/network", networkRoutes);

const intervalRoutes = require("./routes/intervalRoutes");
app.use("/api/interval", intervalRoutes);

const siteRoutes = require("./routes/siteRoutes");
app.use("/api/sites", siteRoutes);

const popularRoutes = require('./routes/popularSiteRoutes');
app.use('/api/sites/popular', popularRoutes);

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const statsRoutes = require("./routes/statsRoutes");
app.use("/api/stats", statsRoutes);
const bookmarksRoutes = require('./routes/bookmarksRoutes');
app.use('/api/bookmarks', bookmarksRoutes);

// 매크로 라우트 추가
app.use('/api/macro', macroRoutes);

// 기본 헬스체크
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// 매크로 시스템 헬스체크
app.get('/api/health/macro', async (req, res) => {
    try {
        const monitoring = await macroCronJobs.macroService.getSystemMonitoring();
        const cronStatus = macroCronJobs.getJobStatus();
        
        const health = {
            status: monitoring.status === 'healthy' && cronStatus.isRunning ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            system: monitoring.systemLoad,
            cronJobs: {
                running: cronStatus.isRunning,
                totalJobs: cronStatus.totalJobs,
                activeJobs: Object.values(cronStatus.jobs).filter(job => job.running).length
            },
            database: {
                connected: true // DB 연결 상태 체크 로직 추가 가능
            }
        };
        
        res.status(health.status === 'healthy' ? 200 : 503).json({
            success: true,
            data: health
        });
        
    } catch (error) {
        res.status(503).json({
            success: false,
            error: '헬스체크 실패',
            details: error.message
        });
    }
});

// 관리자 API들
// 크론잡 상태 확인 API
app.get('/api/admin/cron-status', (req, res) => {
    try {
        const status = macroCronJobs.getJobStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 특정 크론잡 재시작 API
app.post('/api/admin/cron-restart/:jobName', (req, res) => {
    try {
        const { jobName } = req.params;
        const success = macroCronJobs.restartJob(jobName);
        
        res.json({
            success,
            message: success ? `${jobName} 작업이 재시작되었습니다` : `${jobName} 작업을 찾을 수 없습니다`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 크론잡 수동 실행 API (테스트용)
app.post('/api/admin/cron-execute/:jobType', async (req, res) => {
    const { jobType } = req.params;
    
    try {
        let result;
        
        switch (jobType) {
            case 'scheduled-check':
                result = await macroCronJobs.macroService.checkScheduledTasks();
                break;
            case 'cleanup':
                result = await macroCronJobs.macroService.cleanupExpiredTasks();
                break;
            case 'monitoring':
                result = await macroCronJobs.macroService.getSystemMonitoring();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: '지원하지 않는 작업 타입입니다'
                });
        }
        
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

// 개발용 테스트 엔드포인트들
if (process.env.NODE_ENV === 'development') {
    // 테스트용 매크로 생성
    app.post('/api/dev/create-test-macro', async (req, res) => {
        try {
            const MacroService = require('./services/MacroService');
            const macroService = new MacroService();
            
            const targetTime = new Date(Date.now() + 60000); // 1분 후
            
            const result = await macroService.scheduleMacroTask(
                null, // userId
                'https://httpbin.org/delay/1', // 테스트 URL
                targetTime.toISOString(),
                'get',
                { timeout: 5000 },
                true // userConsent
            );
            
            res.json({
                success: true,
                data: result,
                message: '테스트 매크로가 생성되었습니다'
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    console.log('🔧 개발 모드: 테스트 엔드포인트 활성화됨');
}

// Socket.io 연결 처리
io.on("connection", (socket) => {
  console.log("클라이언트 연결됨:", socket.id);

  // 매크로 관련 실시간 이벤트 처리
  socket.on("subscribe-macro-updates", (data) => {
    console.log("매크로 업데이트 구독:", socket.id);
    socket.join("macro-updates");
  });

  socket.on("unsubscribe-macro-updates", () => {
    console.log("매크로 업데이트 구독 해제:", socket.id);
    socket.leave("macro-updates");
  });

  socket.on("disconnect", () => {
    console.log("클라이언트 연결 해제:", socket.id);
  });
});

// 404 핸들러
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('서버 에러:', error);
  res.status(500).json({ 
    error: "Internal server error",
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 매크로 시스템 초기화 함수
async function initializeMacroSystem() {
    try {
        console.log('🔧 매크로 시스템 초기화 중...');
        
        // DB 연결 테스트
        const MacroService = require('./services/MacroService');
        const macroService = new MacroService();
        
        await macroService.pool.query('SELECT 1');
        console.log('✅ DB 연결 확인됨');
        
        // 멈춘 작업들 복구
        const stuckTasks = await macroService.pool.query(`
            UPDATE macro_tasks 
            SET status = 'failed', 
                error_message = '서버 재시작으로 인한 작업 실패'
            WHERE status = 'running'
        `);
        
        if (stuckTasks.rowCount > 0) {
            console.log(`🔧 멈춘 작업 ${stuckTasks.rowCount}개 복구됨`);
        }
        
        console.log('✅ 매크로 시스템 초기화 완료');
        
    } catch (error) {
        console.error('❌ 매크로 시스템 초기화 실패:', error.message);
        throw error;
    }
}

// Graceful shutdown 함수
function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} 신호 수신, 서버 종료 중...`);
    
    // 크론잡 정리
    if (macroCronJobs.isRunning) {
        console.log('⏰ 매크로 크론잡 중지 중...');
        macroCronJobs.gracefulShutdown();
    }
    
    // Socket.io 정리
    io.close(() => {
        console.log('✅ Socket.io 서버 종료됨');
    });
    
    // HTTP 서버 종료
    server.close((err) => {
        if (err) {
            console.error('❌ 서버 종료 중 오류:', err);
            process.exit(1);
        }
        
        console.log('✅ 서버가 정상적으로 종료되었습니다');
        process.exit(0);
    });
    
    // 30초 후 강제 종료
    setTimeout(() => {
        console.error('❌ 강제 종료: 30초 내에 정상 종료되지 않음');
        process.exit(1);
    }, 30000);
}

// 프로세스 신호 처리
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// 예외 처리
process.on('uncaughtException', (error) => {
    console.error('❌ 처리되지 않은 예외:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 처리되지 않은 Promise 거부:', reason);
    // 서버는 계속 실행하되 에러만 로그
});

// 서버 시작
async function startServer() {
    try {
        // 매크로 시스템 초기화
        await initializeMacroSystem();
        
        // 서버 시작
        server.listen(PORT, () => {
            console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
            
            // 프로덕션 환경에서만 크론잡 자동 시작
            if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
                console.log('⏰ 매크로 크론잡 시작 중...');
                try {
                    macroCronJobs.startAllJobs();
                    console.log('✅ 매크로 크론잡이 성공적으로 시작되었습니다');
                    
                    // Socket.io로 크론잡 시작 알림
                    io.emit('cron-status', { status: 'started', timestamp: new Date().toISOString() });
                } catch (error) {
                    console.error('❌ 매크로 크론잡 시작 실패:', error.message);
                }
            } else {
                console.log('ℹ️ 개발 환경: 매크로 크론잡이 비활성화되었습니다');
                console.log('   활성화하려면 ENABLE_CRON=true 환경변수를 설정하세요');
            }
        });
        
    } catch (error) {
        console.error('❌ 서버 시작 실패:', error.message);
        process.exit(1);
    }
}

// 서버 시작 실행
startServer();

// Socket.io를 매크로 시스템에서 사용할 수 있도록 export
module.exports = { app, server, io };