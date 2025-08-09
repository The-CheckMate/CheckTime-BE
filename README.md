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
        ```
        DROP TABLE IF EXISTS user_favorites CASCADE;
        ```
2. user_bookmarks 관련 기능 추가
    - 사용자 설정 필요
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
    
    