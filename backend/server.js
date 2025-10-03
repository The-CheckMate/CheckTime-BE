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

// 반응속도
const refreshRecordsRouter = require('./routes/refreshRecords');
app.use('/api/refresh-records', refreshRecordsRouter);

// 기본 헬스체크
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Socket.io 연결 처리
io.on("connection", (socket) => {
  console.log("클라이언트 연결됨:", socket.id);

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

// Graceful shutdown 함수
function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} 신호 수신, 서버 종료 중...`);

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
        // 서버 시작
        server.listen(PORT, () => {
            console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
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