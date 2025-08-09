## 🔓서버 실행
```
$ cd backend
$ npm run dev
```

## 📍notice
1. 스키마 업데이트 (sites / site_discovery_logs / korean_domain_mappings) (08/08)
    - database/schema.sql 하단 참고해주세요
    - 특히 sites 테이블 수정 주의. alter 방식으로 올려두었습니다. 기존 테이블 그대로 두셔도 됩니다. 
2. 변경 사항
    - 기능 추가 : DB에 미등록된 검색어에 대해 유효 url 탐색

## 테스트
    
    npm install axios puppeteer cheerio fast-levenshtein node-cache
    
- GET | `http://localhost:3001/api/sites/search?q=`
    