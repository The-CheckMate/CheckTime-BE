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

## 테스트
    
    