-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Seoul',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 사이트 테이블
CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    url VARCHAR(500) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    description TEXT,
    optimal_offset INTEGER DEFAULT 2500, -- 밀리초 단위
    keywords TEXT[], -- 검색용 키워드 배열
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    usage_count INTEGER DEFAULT 0,
    average_rtt DECIMAL(10,2) DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 도메인 매핑 테이블 (한글 도메인 → URL)
CREATE TABLE domain_mappings (
    id SERIAL PRIMARY KEY,
    korean_name VARCHAR(200) NOT NULL,
    actual_url VARCHAR(500) NOT NULL,
    site_id INTEGER REFERENCES sites(id),
    similarity_threshold DECIMAL(3,2) DEFAULT 0.8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 접속 로그 테이블
CREATE TABLE access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    site_id INTEGER REFERENCES sites(id),
    target_time TIMESTAMP NOT NULL,
    actual_access_time TIMESTAMP NOT NULL,
    rtt DECIMAL(10,2), -- RTT 측정값 (ms)
    network_delay DECIMAL(10,2), -- 네트워크 지연 (ms)
    success BOOLEAN NOT NULL,
    optimal_offset INTEGER, -- 사용된 최적 오프셋
    confidence_score DECIMAL(5,2), -- 신뢰도 점수
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 사용자 즐겨찾기 테이블 <<<<<<<<<<< 불필요한 테이블 (8/9 이후로 설정 안 해도 됩니다!)
CREATE TABLE user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    site_id INTEGER REFERENCES sites(id),
    custom_name VARCHAR(200),
    custom_offset INTEGER, -- 개인 맞춤 오프셋
    notification_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, site_id)
);

-- NTP 동기화 로그 테이블
CREATE TABLE ntp_sync_logs (
    id SERIAL PRIMARY KEY,
    ntp_server VARCHAR(255) NOT NULL,
    offset_ms DECIMAL(10,3), -- 시간 오프셋 (ms)
    accuracy_ms DECIMAL(10,3), -- 정확도 (ms)
    rtt_ms DECIMAL(10,2), -- NTP 서버 RTT
    success BOOLEAN NOT NULL,
    error_message TEXT,
    sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 네트워크 성능 측정 로그
CREATE TABLE network_performance_logs (
    id SERIAL PRIMARY KEY,
    target_url VARCHAR(500) NOT NULL,
    rtt_samples DECIMAL(10,2)[], -- RTT 샘플 배열
    average_rtt DECIMAL(10,2),
    min_rtt DECIMAL(10,2),
    max_rtt DECIMAL(10,2),
    packet_loss_rate DECIMAL(5,2),
    network_condition VARCHAR(20), -- 'excellent', 'good', 'fair', 'poor'
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX idx_access_logs_site_id ON access_logs(site_id);
CREATE INDEX idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX idx_sites_category ON sites(category);
CREATE INDEX idx_sites_usage_count ON sites(usage_count DESC);
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_domain_mappings_korean_name ON domain_mappings(korean_name);
CREATE INDEX idx_ntp_sync_logs_timestamp ON ntp_sync_logs(sync_timestamp);

-- 트리거 함수 - updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 초기 데이터 삽입
INSERT INTO sites (url, name, category, optimal_offset, keywords) VALUES
('https://sugang.ssu.ac.kr', '숭실대학교 수강신청', '수강신청', 2500, ARRAY['숭실대', '수강신청', 'SSU']),
('https://ticket.interpark.com', '인터파크 티켓', '티켓팅', 2000, ARRAY['인터파크', '티켓', '콘서트']),
('https://www.musinsa.com', '무신사', '쇼핑', 3000, ARRAY['무신사', '쇼핑', '패션']),
('https://www.yes24.com', 'YES24', '쇼핑', 2500, ARRAY['예스24', '책', '도서']),
('https://www.gmarket.co.kr', 'G마켓', '쇼핑', 2800, ARRAY['지마켓', '쇼핑몰']);

INSERT INTO domain_mappings (korean_name, actual_url, similarity_threshold) VALUES
('숭실대', 'https://sugang.ssu.ac.kr', 0.7),
('숭실대학교', 'https://sugang.ssu.ac.kr', 0.8),
('인터파크', 'https://ticket.interpark.com', 0.8),
('무신사', 'https://www.musinsa.com', 0.8),
('예스24', 'https://www.yes24.com', 0.7),
('지마켓', 'https://www.gmarket.co.kr', 0.7);

-------------------------------------------------
--- 사이트 자동 발견 및 등록 기능을 위한 스키마 수정 ---
-------------------------------------------------

-- sites 테이블에 자동 발견 관련 컬럼 추가
ALTER TABLE sites 
ADD COLUMN auto_discovered BOOLEAN DEFAULT FALSE,
ADD COLUMN discovery_source VARCHAR(50),
ADD COLUMN discovery_confidence DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN last_verified_at TIMESTAMP;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_sites_auto_discovered ON sites(auto_discovered);
CREATE INDEX idx_sites_discovery_source ON sites(discovery_source);

-- 사이트 발견 시도 및 결과를 기록하는 테이블
CREATE TABLE site_discovery_logs (
    id SERIAL PRIMARY KEY,
    search_term VARCHAR(255) NOT NULL,
    discovered_url VARCHAR(500),
    discovery_method VARCHAR(50),
    confidence_score DECIMAL(3,2),
    site_id INTEGER REFERENCES sites(id),
    user_id INTEGER REFERENCES users(id),
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 로그 테이블 인덱스 생성
CREATE INDEX idx_discovery_search_term ON site_discovery_logs(search_term);
CREATE INDEX idx_discovery_success ON site_discovery_logs(success);
CREATE INDEX idx_discovery_created_at ON site_discovery_logs(created_at);

-- 한글 검색어를 실제 도메인으로 매핑하는 테이블
CREATE TABLE korean_domain_mappings (
    id SERIAL PRIMARY KEY,
    korean_name VARCHAR(100) NOT NULL UNIQUE,
    actual_url VARCHAR(500) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    similarity_threshold DECIMAL(3,2) DEFAULT 0.80,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 매핑 테이블 인덱스
CREATE INDEX idx_korean_mappings_name ON korean_domain_mappings(korean_name);
CREATE INDEX idx_korean_mappings_verified ON korean_domain_mappings(verified);

-- 기본 매핑 데이터 삽입
INSERT INTO korean_domain_mappings (korean_name, actual_url, domain, category, verified) VALUES
('서울대', 'https://www.snu.ac.kr', 'snu.ac.kr', '교육기관', true),
('서울대학교', 'https://www.snu.ac.kr', 'snu.ac.kr', '교육기관', true),
('연세대', 'https://www.yonsei.ac.kr', 'yonsei.ac.kr', '교육기관', true),
('고려대', 'https://www.korea.edu', 'korea.edu', '교육기관', true),
('카이스트', 'https://www.kaist.ac.kr', 'kaist.ac.kr', '교육기관', true),
('네이버', 'https://www.naver.com', 'naver.com', '포털', true),
('다음', 'https://www.daum.net', 'daum.net', '포털', true),
('구글', 'https://www.google.com', 'google.com', '포털', true);

-------------------------------------------------
--- 북마크 기능을 위한 스키마 수정 ---
-------------------------------------------------
-- user_favorites 테이블 삭제
DROP TABLE IF EXISTS user_favorites CASCADE;

-- user_bookmarks 테이블 생성
CREATE TABLE user_bookmarks (
    id SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    custom_name       VARCHAR(200) NOT NULL,           -- 사용자가 지정한 북마크명
    custom_url        VARCHAR(500) NOT NULL,           -- 북마크한 URL
    favicon    VARCHAR(500),                    -- 파비콘 URL (옵션)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, custom_url)                        -- 사용자 당 URL 중복 방지
);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER trg_user_bookmarks_updated_at
  BEFORE UPDATE ON user_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-------------------------------------------------
--- 인기 사이트 기능을 위한 스키마 수정 ---
-------------------------------------------------
CREATE TABLE IF NOT EXISTS popular_site_clicks (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_popular_site_clicks_time ON popular_site_clicks (clicked_at);
CREATE INDEX idx_popular_site_clicks_category ON popular_site_clicks (category);
CREATE INDEX idx_popular_site_clicks_time_category ON popular_site_clicks (clicked_at, category);
