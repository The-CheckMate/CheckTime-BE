const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

class SocketConfig {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.connectedClients = new Map();
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Socket.io 미들웨어 설정
   */
  setupMiddleware() {
    // 인증 미들웨어 (선택적)
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.userId = decoded.userId;
          socket.userEmail = decoded.email;
        } catch (error) {
          console.log('Socket 인증 실패:', error.message);
        }
      }
      
      next();
    });

    // 로깅 미들웨어
    this.io.use((socket, next) => {
      console.log(`Socket 연결 시도: ${socket.id} (IP: ${socket.handshake.address})`);
      next();
    });
  }

  /**
   * 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✅ 클라이언트 연결: ${socket.id}`);
      
      // 클라이언트 정보 저장
      this.connectedClients.set(socket.id, {
        userId: socket.userId,
        email: socket.userEmail,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // 클라이언트에게 연결 확인 메시지 전송
      socket.emit('connected', {
        message: '서버에 연결되었습니다',
        socketId: socket.id,
        serverTime: new Date().toISOString()
      });

      // 실시간 시간 동기화 요청
      socket.on('request_time_sync', () => {
        this.handleTimeSyncRequest(socket);
      });

      // 최적 접속 시간 계산 요청
      socket.on('calculate_optimal_time', (data) => {
        this.handleOptimalTimeCalculation(socket, data);
      });

      // 알림 구독
      socket.on('subscribe_notifications', (data) => {
        this.handleNotificationSubscription(socket, data);
      });

      // 알림 구독 해제
      socket.on('unsubscribe_notifications', (data) => {
        this.handleNotificationUnsubscription(socket, data);
      });

      // 활동 업데이트
      socket.on('activity_update', () => {
        this.updateClientActivity(socket.id);
      });

      // 연결 해제
      socket.on('disconnect', (reason) => {
        console.log(`❌ 클라이언트 연결 해제: ${socket.id} (${reason})`);
        this.connectedClients.delete(socket.id);
      });

      // 에러 처리
      socket.on('error', (error) => {
        console.error(`Socket 에러 (${socket.id}):`, error);
      });
    });
  }

  /**
   * 시간 동기화 요청 처리
   */
  async handleTimeSyncRequest(socket) {
    try {
      const TimeService = require('../services/TimeService');
      const timeService = new TimeService();
      
      const currentTime = await timeService.getCurrentTime();
      
      socket.emit('time_sync_response', {
        success: true,
        data: currentTime,
        timestamp: Date.now()
      });
      
      this.updateClientActivity(socket.id);
    } catch (error) {
      socket.emit('time_sync_response', {
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 최적 접속 시간 계산 처리
   */
  async handleOptimalTimeCalculation(socket, data) {
    try {
      const IntervalService = require('../services/IntervalService');
      const intervalService = new IntervalService();
      
      const result = await intervalService.calculateOptimalInterval(data);
      
      socket.emit('optimal_time_response', {
        success: true,
        data: result
      });
      
      this.updateClientActivity(socket.id);
    } catch (error) {
      socket.emit('optimal_time_response', {
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 알림 구독 처리
   */
  handleNotificationSubscription(socket, data) {
    const { siteUrl, targetTime } = data;
    
    // 방(room)에 참여
    const roomName = `notification_${siteUrl}`;
    socket.join(roomName);
    
    console.log(`클라이언트 ${socket.id}가 ${roomName} 알림 구독`);
    
    socket.emit('notification_subscribed', {
      success: true,
      siteUrl,
      targetTime,
      roomName
    });
    
    this.updateClientActivity(socket.id);
  }

  /**
   * 알림 구독 해제 처리
   */
  handleNotificationUnsubscription(socket, data) {
    const { siteUrl } = data;
    const roomName = `notification_${siteUrl}`;
    
    socket.leave(roomName);
    
    console.log(`클라이언트 ${socket.id}가 ${roomName} 알림 구독 해제`);
    
    socket.emit('notification_unsubscribed', {
      success: true,
      siteUrl
    });
  }

  /**
   * 클라이언트 활동 업데이트
   */
  updateClientActivity(socketId) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  /**
   * 모든 클라이언트에게 시간 동기화 브로드캐스트
   */
  broadcastTimeSync(timeData) {
    this.io.emit('time_sync', {
      type: 'TIME_UPDATE',
      data: timeData,
      timestamp: Date.now()
    });
  }

  /**
   * 특정 사이트에 대한 최적 시점 알림
   */
  broadcastOptimalTimeAlert(siteUrl, message, data) {
    const roomName = `notification_${siteUrl}`;
    
    this.io.to(roomName).emit('optimal_time_alert', {
      type: 'OPTIMAL_TIME_ALERT',
      siteUrl,
      message,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 연결된 클라이언트 수 반환
   */
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  /**
   * 연결된 클라이언트 정보 반환
   */
  getConnectedClients() {
    return Array.from(this.connectedClients.entries()).map(([socketId, client]) => ({
      socketId,
      ...client
    }));
  }

  /**
   * 특정 사용자에게 메시지 전송
   */
  sendToUser(userId, event, data) {
    const targetSocket = Array.from(this.connectedClients.entries())
      .find(([_, client]) => client.userId === userId);
    
    if (targetSocket) {
      this.io.to(targetSocket[0]).emit(event, data);
      return true;
    }
    
    return false;
  }

  /**
   * Socket.io 인스턴스 반환
   */
  getIO() {
    return this.io;
  }
}

module.exports = SocketConfig;