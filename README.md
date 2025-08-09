## 🔓서버 실행
```
$ cd backend
$ npm run dev
```

## 📍notice
1. user_favorites 관련 코드 삭제
    -  user_bookmarks로 대체하기 위함
    -  notification_enabled 북마크 알림 관련 기능 제거
    - favicon(페이지 대표 이미지) 추가 예정
    -  사용자 설정 필요
        ```sql
        DROP TABLE IF EXISTS user_favorites CASCADE;
        ```
2. user_bookmarks 관련 기능 추가
    - 사용자 설정 필요
        ```
        npm install node-fetch
        ```
        ```sql
        CREATE TABLE user_bookmarks (
        id SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        custom_name       VARCHAR(200) NOT NULL,           -- 사용자가 지정한 북마크명
        custom_url        VARCHAR(500) NOT NULL,           -- 북마크한 URL
        favicon    VARCHAR(500),                    -- 파비콘 URL (옵션)
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, url)                        -- 사용자 당 URL 중복 방지
        );

        -- updated_at 자동 갱신 트리거
        CREATE TRIGGER trg_user_bookmarks_updated_at
        BEFORE UPDATE ON user_bookmarks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ```
## 테스트
- 사전 로그인 상태 필요 (Auth)
- 북마크 목록 조회 | GET http://localhost:3001/api/bookmarks
- 북마크 추가 | POST http://localhost:3001/api/bookmarks / body 작성
- 북마크 수정 | PUT http://localhost:3001/api/bookmarks/1 / body 작성
- 북마크 삭제 | DELETE http://localhost:3001/api/bookmarks/1
- 북마크 클릭 | GET http://localhost:3001/api/bookmarks/1/click