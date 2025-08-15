# 매크로

---

### [핵심 서비스]

- **MacroService.js**: 매크로 예약, 실행, 관리의 모든 비즈니스 로직
- **macroRoutes.js**: REST API 엔드포인트 (예약, 실행, 조회, 통계 등)데이터베이스
- 4가지 매크로 타입 지원 **refresh, get, post, form**

### [자동화 시스템]

- **크론잡**: 예약된 작업 실행, 정리, 모니터링, 통계 집계
    - 매분마다: 예약된 매크로 작업 체크 및 실행
    - 매일 자정: 만료된 작업 자동 정리
    - 5분마다: 시스템 상태 모니터링
    - 30분마다: 데드락 방지 및 긴급 복구
    - 새벽 2시: 통계 집계
- **시스템 복구**: 멈춘 작업 자동 복구, 메모리 관리
- **알림 시스템**: 높은 부하 감지 및 경고

### [MACRO SCHEMA]

- **매크로 테이블들**: macro_tasks, macro_execution_logs, macro_presets
- **인덱스 및 제약조건**: 성능 최적화 및 데이터 무결성
- **유틸리티 함수들**: 정리, 통계, 모니터링

```sql
# psql -U checktime_user -d checktime -h localhost -p 5432로 checktime 들어가서 아래 명령어로 스키마 적용
\i backend/database/macro_schema.sql

# 테이블 확인
\dt macro_*

# 테스트 데이터 삽입 확인
SELECT COUNT(*) FROM macro_system_config;

# 뷰 확인
\dv *macro*
```

### [TEST]

- 프로젝트의 루트에 테스트 스크립트인 test_macro_api.js 파일 생성

```bash
# 크론잡 활성화 서버 실행! 나중에 테스트할 때 그냥 npm run dev 해도 될 걸
ENABLE_CRON=true npm run dev

# 테스트 전체 실행 (프로젝트 루트 디렉토리로 이동)
node test_macro_api.js

# 이 명령어로 테스트 옵션 확인 가능, 필요할 때 알아서 맞게 하3
node test_macro_api.js help
```

| **카테고리** | **API** | **테스트 함수** |
| --- | --- | --- |
| **매크로 실행** | `POST /macro/execute` | `testImmediateExecution()` |
|  | `POST /macro/schedule` | `testMacroScheduling()` |
| **작업 관리** | `GET /macro/tasks` | `testTaskManagement()` |
|  | `GET /macro/tasks/:id` | `testTaskManagement()` |
|  | `DELETE /macro/tasks/:id` | `testTaskManagement()` |
| **시스템 관리** | `POST /macro/check-scheduled` | `testStatsAndMonitoring()` (관리자 API로) |
|  | `GET /macro/stats` | `testStatsAndMonitoring()` |
|  | `GET /macro/monitor` | `testStatsAndMonitoring()` |
|  | `POST /macro/cleanup` | `cleanupTestData()` (관리자 API로) |

- 수동 테스트

```bash
# 헬스 체크
GET http://localhost:3001/health
GET http://localhost:3001/api/health/macro

# 즉시 실행
POST http://localhost:3001/api/macro/execute
{
  "targetUrl": "https://httpbin.org/get",
  "macroType": "get",
  "userConsent": true,
  "settings": {
    "timeout": 5000
  }
}

# 매크로 예약
POST http://localhost:3001/api/macro/schedule
{
  "targetUrl": "https://httpbin.org/delay/1",
  "targetTime": "2025-01-17T16:00:00.000Z",
  "macroType": "get",
  "userConsent": true,
  "settings": {
    "timeout": 8000
  }
}

# 작업 목록 확인 (아래의 조회보다 이게 더 보기 편함)
GET /api/macro/tasks

# 작업 목록 조회
GET http://localhost:3001/api/macro/tasks?page=1&limit=10

# 시스템 모니터링
GET /api/macro/monitor

# 시스템 상태 확인
GET http://localhost:3001/api/macro/monitor
GET http://localhost:3001/api/admin/cron-status
```

- 위의 명령어 실행 후, DB에서 결과 확인 (아래에 결과 예시 사진 첨부)

```sql
-- 예약된 작업들
SELECT id, target_url, macro_type, status, created_at, optimal_refresh_time 
FROM macro_tasks 
ORDER BY created_at DESC;

-- 실행 로그들
SELECT target_url, macro_type, success, response_time, executed_at 
FROM macro_execution_logs 
ORDER BY executed_at DESC 
LIMIT 10;

-- 이런 식으로 확인도 가능
SELECT * FROM macro_tasks WHERE id = 2;
```


### [API 엔드포인트 및 구현]

- 프리셋 만들고 싶었으나, 인증 절차가 복잡하고 자꾸 인증 토큰 에러가 나서 일단 핵심 기능만 구현함

```bash
*************
*매크로 실행 관련
*************

// 특정 시간에 매크로 자동 실행 예약 (24시간 이내)
POST http://localhost:3001/api/macro/schedule
{
  "targetUrl": "https://ticket.interpark.com/goods/24001234",
  "targetTime": "2025-08-20T14:00:00Z",
  "macroType": "refresh",
  "userConsent": true,
  "settings": {
    "timeout": 5000,
    "headers": {"User-Agent": "Custom"}
  }
}

// 매크로 설정 테스트 및 즉시 실행
POST http://localhost:3001/api/macro/execute
{
  "targetUrl": "https://httpbin.org/post",
  "macroType": "post",
  "userConsent": true,
  "settings": {
    "timeout": 8000,
    "body": {"test": "immediate-execution"},
    "headers": {"Content-Type": "application/json"}
  }
}

// 설정 유효성 + URL 접근성 확인
POST http://localhost:3001/api/macro/test
{
  "targetUrl": "https://httpbin.org/get",
  "macroType": "get",
  "settings": {"timeout": 5000}
}

************
*작업 관리 관련
************

// 작업 목록 조회
GET http://localhost:3001/api/macro/tasks?status=scheduled&page=1&limit=10

// 작업 상세 조회 (특정 작업의 상세 정보 및 실행 로그)
GET http://localhost:3001/api/macro/tasks/**[taskId]**

// 예약된 작업 취소
DELETE http://localhost:3001/api/macro/tasks/**[taskId]**

*************
*시스템 관리 관련
*************

// 실시간 시스템 상태 확인
GET http://localhost:3001/api/macro/monitor

// 실행 통계 (기본 30일)
GET http://localhost:3001/api/macro/stats?day=7

// 크론잡 대신...예약된 작업 수동으로 체크
POST http://localhost:3001/api/macro/check-scheduled

// 만료된 작업 정리
POST http://localhost:3001/api/macro/cleanup
{"days": 30}

// 매크로 설정 유효성 검증하는 유틸리티인데... 쓸 일은 없을 것
POST http://localhost:3001/api/macro/validate-settings
body 예시임
{
  "macroType": "form",
  "settings": {
    "timeout": 8000,
    "formFields": {"email": "test@example.com"},
    "contentType": "application/x-www-form-urlencoded"
  }
}
```

### [참고]

- live_macro_test.js로 테스트함
- 크론잡이 분마다 실행이라 30초간 간격으로 테스트해서 타이밍이 안 맞는 듯…대신 수동 실행으로 대체 되면서 동작 가능, 코드 작성 시 참고

```bash
⚠️ [3:21:10 PM] ⏰ 실행 시간이 지났는데 아직 scheduled 상태... 크론잡 확인 필요
⚠️ [3:21:15 PM] ⏰ 실행 시간이 지났는데 아직 scheduled 상태... 크론잡 확인 필요
ℹ️ [3:21:20 PM] 🔧 35초 경과 - 수동 크론잡 실행 시도
ℹ️ [3:21:20 PM] === 수동 크론잡 실행 ===
ℹ️ [3:21:20 PM] 📊 작업 상태 변경: scheduled → running
⏳ [3:21:20 PM] 🏃‍♂️ 작업 실행 중...
✅ [3:21:21 PM] ✅ 수동 실행 완료: 1개 작업 처리됨
✅ [3:21:21 PM]   1. Task 28: ✅ 성공
ℹ️ [3:21:25 PM] 📊 작업 상태 변경: running → completed
✅ [3:21:25 PM] 🎉 작업 완료!
ℹ️ [3:21:25 PM] 실행 시간: 2025-08-15T06:21:21.967Z
ℹ️ [3:21:25 PM] 응답 시간: 1166ms
ℹ️ [3:21:25 PM] 상태 코드: 200
✅ [3:21:25 PM] 성공 여부: true
ℹ️ [3:21:25 PM] 실행 로그: 1개 항목
ℹ️ [3:21:25 PM]   1. 2025-08-15T06:21:21.992Z - 성공: true, 응답시간: 1166ms

============================================================
📊 테스트 결과
============================================================
✅ [3:21:25 PM] 🎉 매크로 자동 실행 테스트 성공!
✅ [3:21:25 PM] 시스템이 정상적으로 동작하고 있습니다.
ℹ️ [3:21:25 PM] === 시스템 모니터링 ===
✅ [3:21:25 PM] 시스템 상태: healthy
ℹ️ [3:21:25 PM] 실행중 작업: 0개
ℹ️ [3:21:25 PM] 대기중 작업: 1개
ℹ️ [3:21:25 PM] 최근 실행: 7회
ℹ️ [3:21:25 PM] 성공률: 100.00%
ℹ️ [3:21:25 PM] 평균 응답시간: 1217ms

🏁 실시간 테스트 완료!
종료 시간: 8/15/2025, 3:21:25 PM

// 백엔드 로그
매크로 실행 시작: Task ID 28, URL: https://httpbin.org/get
🔍 updateTaskStatus 호출: { taskId: 28, status: 'running', resultData: 'object' }
✅ updateTaskStatus 성공
2025-08-15T06:21:20.872Z - GET /api/macro/tasks/28
🔍 updateTaskStatus 호출: { taskId: 28, status: 'completed', resultData: 'object' }
✅ updateTaskStatus 성공
🔍 logExecution 호출됨:
  resultData type: object
  resultData value: {
  success: true,
  responseTime: 1166,
  statusCode: 200,
  statusText: 'OK',
  headers: Object [AxiosHeaders] {
    date: 'Fri, 15 Aug 2025 06:21:21 GMT',
    'content-type': 'application/json',
    'content-length': '454',
    connection: 'keep-alive',
    server: 'gunicorn/19.9.0',
    'access-control-allow-origin': '*',
    'access-control-allow-credentials': 'true'
  },
  dataSize: 375,
  responseData: {
    args: {},
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, compress, deflate, br',
      Host: 'httpbin.org',
      'User-Agent': 'Navism-Macro/1.0',
      'X-Amzn-Trace-Id': 'Root=1-689ed1e1-2ce4e7042e28dd153a70ae17',
      'X-Test-Id': 'xdejo2fi3',
      'X-Test-Time': '2025-08-15T06:20:41.945Z',
      'X-Test-Type': 'live-test'
    },
    origin: '59.7.14.69',
    url: 'https://httpbin.org/get'
  }
}
```
