# ⏱ CheckTime
> **네트워크 지연을 반영한 정밀 서버 시간 측정 및 티켓팅 전략 지원 웹 서비스**
>
> 2025 교내 IT 프로젝트 공모전 **장려상** 수상작

<br>

## 📌 프로젝트 개요

인기 콘서트 티켓팅이나 대학 수강신청에서 **몇 초 차이로 성패가 갈리는** 상황에서, 대부분의 사용자는 브라우저 로컬 시간을 기준으로 판단하여 실제 서버 오픈 시간과 오차가 발생합니다.

CheckTime은 **NTP 기반 서버 시간 동기화**, **RTT 측정을 통한 네트워크 지연 보정**, **최적 새로고침 타이밍 계산**을 핵심 기능으로 제공하는 웹 서비스입니다.

```
브라우저 로컬 시간 ≠ 서버 시간  →  몇 초 차이로 티켓팅 실패
                   ↓
  CheckTime: NTP 동기화 + RTT 보정  →  정확한 서버 시간 + 최적 클릭 타이밍 안내
```

<br>

## 🛠 기술 스택

| 구분 | 기술 | 선택 이유 |
|------|------|-----------|
| **Frontend** | Next.js (TypeScript) | SSR 기반 빠른 초기 렌더링, 서버 시간 표시 정확도 향상 |
| **Backend** | Node.js v22 + Express | 비동기 I/O 특성으로 RTT 다중 측정 처리에 유리 |
| **Database** | PostgreSQL 17 | 접속 로그, 사용자 패턴 분석 등 복잡한 집계 쿼리에 적합 |
| **시간 동기화** | NTP (pool.ntp.org, time.google.com) | 밀리초 단위 정밀 서버 시간 획득 |
| **URL 탐색** | Puppeteer + Cheerio | 네이버 스크래핑 및 메타 정보 수집 |
| **배포** | Railway | 간편한 배포 및 PostgreSQL 통합 지원 |

<br>

## ⚙️ 주요 기능 및 기술 설명

### 1. 서버 시간 동기화 — NTP + RTT 보정

> 단순히 시간을 보여주는 것이 아닌, **네트워크 지연까지 고려한 정밀 서버 시간**을 제공합니다.

**동작 방식:**

```
클라이언트 → NTP 서버에 3회 연속 HTTP 요청 → 왕복 시간(RTT) 측정
                        ↓
          RTT 평균값 / 2  =  편도 네트워크 지연 (오프셋)
                        ↓
          서버 응답 시간 - 오프셋  =  실제 서버 도달 시각
```

- `pool.ntp.org`, `time.google.com`, `time.cloudflare.com` 3개 서버 중 가장 안정적인 값 채택
- **크리스티안 알고리즘** 기반 RTT 측정 + **다중 샘플링**으로 정확도 개선
- 시간차가 임계값 이상 벌어지면 **Web Workers를 활용한 백그라운드 자동 재동기화** 수행 (메인 스레드 블로킹 방지)

```
// 동기화 결과 예시
NTP 동기화 완료 - 오프셋: -164.67ms, 정확도: ±200.50ms
```

**핵심 API:**
```http
POST /api/time/compare
Body: { "targetUrl": "https://www.naver.com", "userId": 3 }
→ 해당 URL 서버 시간, RTT, 네트워크 상태, 최적 오프셋 반환
```

<br>

### 2. 최적 새로고침 인터벌 계산 — 동적 적응형 알고리즘

> 티켓팅 오픈 시각을 입력하면 **"몇 초 전에 새로고침해야 하는지"** 정확한 시각을 계산해 안내합니다.

**계산 요소:**

| 요소 | 설명 |
|------|------|
| 현재 RTT | 실시간 네트워크 왕복 시간 |
| 네트워크 상태 | excellent / good / poor 3단계 분류 |
| 서버 부하 | 응답 시간 기반 추정 |
| 사용자 성공률 | `access_logs` 기반 과거 성공 이력 반영 |
| 시간대 보정 | 피크 타임 가중치 적용 |

```json
// 응답 예시: 인터파크 17:00 티켓팅 기준 → 4.5초 전 새로고침 권장
{
  "optimalRefreshTime": "2025-09-20T16:59:55.499Z",
  "refreshInterval": 4501,
  "confidenceScore": 85,
  "networkAnalysis": { "condition": "excellent", "averageRTT": 5 },
  "alertSettings": [
    { "type": "custom_reminder", "message": "30초 전에 알림이 설정되었습니다." },
    { "type": "action", "message": "지금 새로고침하세요!", "priority": "high" }
  ]
}
```

**핵심 API:**
```http
POST /api/interval/calculate
Body: { "targetUrl": "...", "targetTime": "2025-09-20T17:00:00Z", "userAlertOffsets": [30, 180] }
```

<br>

### 3. 사이트 검색 — 유사도 분석 + 자동 URL 발견

> URL을 모르거나 오타를 입력해도 **유효한 공식 URL을 자동으로 찾아** 등록합니다.

**검색 흐름:**

```
사용자 입력
    ↓
① DB 내 유사도 검사 (Levenshtein Distance 기반)
    ↓  유사도 0.9 미만 시 → SiteDiscoveryService 실행
② 4단계 자동 발견 전략
    ├─ Step 0. 유효 URL 직접 입력 여부 확인 (HEAD 요청, 3초 타임아웃)
    ├─ Step 1. 대학교 API (hipolabs.com) — 한국 대학 공식 URL 조회
    ├─ Step 2. 한국 도메인 패턴 시도 (.ac.kr / .go.kr / .co.kr)
    ├─ Step 3. 네이버 검색 스크래핑 (Puppeteer) — "공식홈페이지" 키워드
    └─ Step 4. 일반 도메인 패턴 시도 (.com / .co.kr / .org 등)
    ↓  발견 성공 시
③ sites 테이블에 자동 등록 후 반환 (confidence score 포함)
    ↓  발견 실패 시
④ DB 내 최고 유사도 결과 fallback 반환
```

**자동 발견 결과 예시:**

| 검색어 | 발견 전략 | 결과 |
|--------|-----------|------|
| `https://www.naver.com/` | direct-url | NAVER (confidence: 1.0) |
| `sanrio` | common-domain | sanrio.com (confidence: 0.65) |
| `아주대` | 자동 발견 실패 | DB 내 최고 유사도 fallback |

**핵심 API:**
```http
GET /api/sites/search?q=숭실대
GET /api/sites/search?q=https://www.naver.com/
```

<br>

### 4. 인기 사이트 조회 — 기간·카테고리별 랭킹

> 실시간 / 일간 / 주간 / 전체 누적 기준으로 인기 사이트를 조회합니다.

- `popular_site_clicks` 테이블에 클릭 이벤트 로그 누적
- `realtime` = 최근 2시간 내 클릭 수 집계
- `category` 필터로 **대학**, **티켓팅** 등 카테고리별 조회 가능

```http
GET /api/sites/popular/popular-sites?period=realtime&category=대학&limit=5
```

<br>

### 5. 매크로 시스템 — 자동 실행 예약

> 특정 시각에 자동으로 URL에 HTTP 요청을 보내는 **매크로 예약 실행** 기능입니다.

- `refresh`, `get`, `post`, `form` 4가지 타입 지원
- 크론잡 기반 예약 실행 (분 단위) + 수동 트리거 API 제공
- 실행 이력 및 시스템 모니터링 API 포함

```bash
# 크론잡 활성화 서버 실행
ENABLE_CRON=true npm run dev
```

```http
POST /api/macro/schedule
Body: { "targetUrl": "https://ticket.interpark.com", "targetTime": "2025-08-20T14:00:00Z", "macroType": "refresh" }
```

<br>

### 6. 북마크 — 자주 가는 사이트 저장

> 로그인 사용자 대상으로 자주 접속하는 사이트를 최대 10개까지 저장합니다.

- 북마크 추가 시 `favicon` 자동 수집
- 북마크 클릭 → 해당 URL 사이트 자동 검색 연동
- 중복 URL 등록 방지, 유효하지 않은 URL도 저장 허용

```http
POST   /api/bookmarks          → 북마크 추가
GET    /api/bookmarks          → 목록 조회
PUT    /api/bookmarks/:id      → 수정
DELETE /api/bookmarks/:id      → 삭제
GET    /api/bookmarks/:id/click → 클릭 (자동 사이트 검색 연동)
```

<br>

### 7. 반응속도 측정 및 랭킹

> 사용자의 클릭 반응 속도를 측정하고 전체 순위를 조회합니다.

- `Performance API` 기반 정밀 반응 시간 측정
- 전체 순위 / 내 순위 / 주변 순위 / TOP 10 조회 API 제공

<br>

## 🗄 데이터베이스 주요 테이블

| 테이블 | 설명 |
|--------|------|
| `users` | 회원 정보 |
| `sites` | 사이트 정보 (자동 발견 포함) |
| `access_logs` | 접속 시도 로그 (RTT, 성공 여부, 오프셋 등) |
| `popular_site_clicks` | 인기 사이트 클릭 이벤트 |
| `user_bookmarks` | 사용자 북마크 |
| `user_refresh_records` | 반응속도 측정 기록 |
| `macro_tasks` | 매크로 예약 작업 |
| `macro_execution_logs` | 매크로 실행 이력 |
| `site_discovery_logs` | URL 자동 발견 시도 이력 |
| `korean_domain_mappings` | 한글명 → 실제 URL 매핑 |

<br>

## 🚀 시작 가이드

### 환경 요구사항

- Node.js v22+
- PostgreSQL 17

### 실행

```bash
# 백엔드 실행
cd backend
npm install
npm run dev

# 프론트엔드 실행
cd frontend
npm install
npm run dev
```

### 환경변수 설정 (`backend/.env`)

```env
PORT=3001
NODE_ENV=development

DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=checktime
DB_USER=your_db_user
DB_PASSWORD=your_db_password

JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

NTP_SERVERS=pool.ntp.org,time.google.com,time.cloudflare.com
AUTO_DISCOVERY_ENABLED=true
ENABLE_CRON=true
```

### DB 초기화

```bash
psql -d checktime -f backend/database/schema.sql
psql -d checktime -f backend/database/sites_register.sql
```

<br>

## 📁 프로젝트 구조

```
CheckTime-BE/
├── backend/
│   ├── controllers/
│   ├── services/
│   │   ├── SiteService.js            # 사이트 검색 & 유사도 계산
│   │   ├── SiteDiscoveryService.js   # URL 자동 발견 (4단계 전략)
│   │   ├── MacroService.js           # 매크로 예약 & 실행
│   │   ├── IntervalService.js        # 새로고침 인터벌 계산
│   │   └── RefreshRecordService.js   # 반응속도 기록
│   ├── routes/
│   ├── database/
│   │   ├── schema.sql
│   │   ├── macro_schema.sql
│   │   └── sites_register.sql
│   └── server.js
├── frontend/
└── Dockerfile
```
