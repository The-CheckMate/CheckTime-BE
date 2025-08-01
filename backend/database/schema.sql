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

-- 사용자 즐겨찾기 테이블
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