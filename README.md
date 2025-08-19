## 🔓서버 실행
```
$ cd backend
$ npm run dev
```

## 📍notice
- 인기 사이트 조회 기능 추가
- 티켓팅 사이트 수동으로 삽입 필요(sql 쿼리 업데이트 예정)

## 테스트
- database/schema.sql 226행~ 실행
    ```
    CREATE TABLE IF NOT EXISTS popular_site_clicks (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL DEFAULT 'general',
        clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_popular_site_clicks_time ON popular_site_clicks (clicked_at);
    CREATE INDEX idx_popular_site_clicks_category ON popular_site_clicks (category);
    CREATE INDEX idx_popular_site_clicks_time_category ON popular_site_clicks (clicked_at, category);
    ```
- 서버 실행
    `npm run dev`
- GET http://localhost:3001/api/sites/popular-sites?period=realtime

    | 키 | 값 | 역할 |
    | --- | --- | --- |
    | period | [daily, weekly, realtime, all] | 기간 설정 |
    | category | ex. 대학, 티켓팅 | 조회할 카테고리 |
    | limit=5 | (숫자) | 가져올 사이트 수 |