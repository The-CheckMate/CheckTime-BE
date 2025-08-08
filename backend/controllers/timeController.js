class TimeController {
  static async getCurrentTime(req, res) {
    try {
      const serverTime = new Date().toISOString();
      const timestamp = Date.now();
      
      res.json({
        success: true,
        data: {
          serverTime,
          timestamp,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '서버 시간을 가져오는데 실패했습니다.',
        error: error.message
      });
    }
  }

  static async syncTime(req, res) {
    try {
      const { clientTime } = req.body;
      const serverTime = Date.now();
      const receivedAt = serverTime;
      
      const rtt = serverTime - new Date(clientTime).getTime();
      
      res.json({
        success: true,
        data: {
          clientTime,
          serverTime,
          receivedAt,
          rtt,
          syncAccuracy: Math.abs(rtt) < 100 ? 'high' : 'low'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '시간 동기화에 실패했습니다.',
        error: error.message
      });
    }
  }
}

module.exports = TimeController;