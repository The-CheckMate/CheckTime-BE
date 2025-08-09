require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const server = http.createServer(app);
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

// timeRoutes부터 시작
const timeRoutes = require("./routes/timeRoutes");
app.use("/api/time", timeRoutes);
const networkRoutes = require("./routes/networkRoutes");
app.use("/api/network", networkRoutes);
const intervalRoutes = require("./routes/intervalRoutes");
app.use("/api/interval", intervalRoutes);
const siteRoutes = require("./routes/siteRoutes");
app.use("/api/sites", siteRoutes);
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
const statsRoutes = require("./routes/statsRoutes");
app.use("/api/stats", statsRoutes);
const bookmarksRoutes = require('./routes/bookmarksRoutes');
app.use('/api/bookmarks', bookmarksRoutes);


app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Socket.io 연결 처리 (주의: socketHandlers 없이 기본만)
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
