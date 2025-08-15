-- =====================================
-- 1. 매크로 작업 테이블
-- =====================================
CREATE TABLE IF NOT EXISTS macro_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_url VARCHAR(2048) NOT NULL,
    target_time TIMESTAMP WITH TIME ZONE NOT NULL,
    macro_type VARCHAR(20) NOT NULL CHECK (macro_type IN ('refresh', 'post', 'get', 'form')),
    optimal_refresh_time TIMESTAMP WITH TIME ZONE NOT NULL,
    settings JSONB DEFAULT '{}',
    user_consent BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' 
        CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE NULL,
    result_data JSONB NULL,
    error_message TEXT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_macro_tasks_user_id ON macro_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_status ON macro_tasks(status);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_target_time ON macro_tasks(target_time);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_optimal_refresh_time ON macro_tasks(optimal_refresh_time);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_created_at ON macro_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_status_optimal_time ON macro_tasks(status, optimal_refresh_time) WHERE status = 'scheduled';

-- =====================================
-- 2. 매크로 실행 로그 테이블
-- =====================================
CREATE TABLE IF NOT EXISTS macro_execution_logs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES macro_tasks(id) ON DELETE CASCADE NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_url VARCHAR(2048) NOT NULL,
    macro_type VARCHAR(20) NOT NULL CHECK (macro_type IN ('refresh', 'post', 'get', 'form')),
    attempt_number INTEGER DEFAULT 1,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL DEFAULT false,
    response_time INTEGER NOT NULL DEFAULT 0, -- 밀리초
    result_data JSONB NULL,
    error_message TEXT NULL,
    client_ip INET NULL,
    user_agent TEXT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_macro_execution_logs_task_id ON macro_execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_macro_execution_logs_user_id ON macro_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_macro_execution_logs_executed_at ON macro_execution_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_macro_execution_logs_success ON macro_execution_logs(success);
CREATE INDEX IF NOT EXISTS idx_macro_execution_logs_target_url ON macro_execution_logs(target_url);
CREATE INDEX IF NOT EXISTS idx_macro_execution_logs_macro_type ON macro_execution_logs(macro_type);

-- =====================================
-- 3. 매크로 프리셋 테이블
-- =====================================
CREATE TABLE IF NOT EXISTS macro_presets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_macro_presets_user_id ON macro_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_macro_presets_name ON macro_presets(name);

-- =====================================
-- 4. 매크로 사용자 동의 로그
-- =====================================
CREATE TABLE IF NOT EXISTS macro_consent_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    consent_type VARCHAR(50) NOT NULL, -- 'auto_refresh', 'auto_request', 'data_collection' 등
    consented BOOLEAN NOT NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    consent_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    consented_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_macro_consent_logs_user_id ON macro_consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_macro_consent_logs_consent_type ON macro_consent_logs(consent_type);
CREATE INDEX IF NOT EXISTS idx_macro_consent_logs_consented_at ON macro_consent_logs(consented_at);

-- =====================================
-- 5. 트리거 및 함수
-- =====================================

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 프리셋 테이블 트리거
DROP TRIGGER IF EXISTS update_macro_presets_updated_at ON macro_presets;
CREATE TRIGGER update_macro_presets_updated_at 
    BEFORE UPDATE ON macro_presets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- 6. 매크로 관련 뷰
-- =====================================

-- 매크로 성능 요약 뷰
CREATE OR REPLACE VIEW macro_performance_summary AS
SELECT 
    macro_type,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN success THEN 1 END) as successful_executions,
    (COUNT(CASE WHEN success THEN 1 END)::FLOAT / COUNT(*) * 100) as success_rate,
    AVG(response_time) as avg_response_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time) as median_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
    MIN(response_time) as min_response_time,
    MAX(response_time) as max_response_time
FROM macro_execution_logs 
WHERE executed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY macro_type;

-- 사용자별 매크로 통계 뷰
CREATE OR REPLACE VIEW user_macro_stats AS
SELECT 
    COALESCE(u.id, 0) as user_id,
    COALESCE(u.username, 'Anonymous') as username,
    COUNT(mel.*) as total_executions,
    COUNT(CASE WHEN mel.success THEN 1 END) as successful_executions,
    (COUNT(CASE WHEN mel.success THEN 1 END)::FLOAT / NULLIF(COUNT(mel.*), 0) * 100) as success_rate,
    AVG(mel.response_time) as avg_response_time,
    COUNT(DISTINCT mel.target_url) as unique_urls,
    COUNT(DISTINCT DATE(mel.executed_at)) as active_days,
    MAX(mel.executed_at) as last_activity
FROM macro_execution_logs mel
LEFT JOIN users u ON mel.user_id = u.id
WHERE mel.executed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY u.id, u.username;

-- 인기 URL 분석 뷰
CREATE OR REPLACE VIEW popular_macro_urls AS
SELECT 
    target_url,
    COUNT(*) as execution_count,
    COUNT(CASE WHEN success THEN 1 END) as success_count,
    (COUNT(CASE WHEN success THEN 1 END)::FLOAT / COUNT(*) * 100) as success_rate,
    AVG(response_time) as avg_response_time,
    COUNT(DISTINCT user_id) as unique_users,
    array_agg(DISTINCT macro_type) as used_macro_types,
    MAX(executed_at) as last_executed
FROM macro_execution_logs 
WHERE executed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY target_url
ORDER BY execution_count DESC;

-- =====================================
-- 7. 유틸리티 함수들
-- =====================================

-- 예약된 매크로 작업 조회 함수
CREATE OR REPLACE FUNCTION get_pending_macro_tasks()
RETURNS TABLE (
    task_id INTEGER,
    target_url VARCHAR(2048),
    macro_type VARCHAR(20),
    settings JSONB,
    optimal_refresh_time TIMESTAMP WITH TIME ZONE,
    time_until_execution INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mt.id,
        mt.target_url,
        mt.macro_type,
        mt.settings,
        mt.optimal_refresh_time,
        (mt.optimal_refresh_time - CURRENT_TIMESTAMP) as time_until_execution
    FROM macro_tasks mt
    WHERE mt.status = 'scheduled'
    AND mt.optimal_refresh_time > CURRENT_TIMESTAMP
    ORDER BY mt.optimal_refresh_time ASC;
END;
$$ LANGUAGE plpgsql;

-- 만료된 작업 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_macro_tasks(cleanup_days INTEGER DEFAULT 30)
RETURNS TABLE (
    deleted_tasks INTEGER,
    deleted_logs INTEGER,
    cleanup_summary TEXT
) AS $$
DECLARE
    task_count INTEGER := 0;
    log_count INTEGER := 0;
BEGIN
    -- 완료/실패/취소된 작업 중 오래된 것들 삭제
    DELETE FROM macro_tasks 
    WHERE status IN ('completed', 'failed', 'cancelled')
    AND (executed_at < CURRENT_TIMESTAMP - (cleanup_days || ' days')::INTERVAL
         OR (executed_at IS NULL AND created_at < CURRENT_TIMESTAMP - (cleanup_days || ' days')::INTERVAL));
    
    GET DIAGNOSTICS task_count = ROW_COUNT;
    
    -- 오래된 실행 로그 정리 (task_id가 NULL인 독립 로그들)
    DELETE FROM macro_execution_logs 
    WHERE task_id IS NULL 
    AND executed_at < CURRENT_TIMESTAMP - (cleanup_days * 3 || ' days')::INTERVAL;
    
    GET DIAGNOSTICS log_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        task_count,
        log_count,
        ('정리 완료: ' || task_count || '개 작업, ' || log_count || '개 로그')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 매크로 통계 집계 함수
CREATE OR REPLACE FUNCTION aggregate_macro_daily_stats(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS INTEGER AS $$
DECLARE
    processed_count INTEGER := 0;
    rec RECORD;
BEGIN
    -- 해당 날짜의 실행 로그를 기반으로 통계 생성
    FOR rec IN
        SELECT 
            target_date::DATE as date,
            user_id,
            macro_type,
            target_url,
            COUNT(*) as total_executions,
            COUNT(CASE WHEN success THEN 1 END) as successful_executions,
            COUNT(CASE WHEN NOT success THEN 1 END) as failed_executions,
            AVG(response_time) as avg_response_time,
            MIN(response_time) as min_response_time,
            MAX(response_time) as max_response_time
        FROM macro_execution_logs 
        WHERE DATE(executed_at) = target_date::DATE
        GROUP BY user_id, macro_type, target_url
    LOOP
        -- 임시 통계 테이블이 있다면 여기에 저장
        -- 현재는 뷰를 사용하므로 실시간 집계
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 8. 권한 및 보안 설정
-- =====================================

-- RLS (Row Level Security) 활성화 (선택적)
-- ALTER TABLE macro_tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE macro_execution_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE macro_presets ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 작업만 볼 수 있도록 정책 설정 (선택적)
/*
CREATE POLICY macro_tasks_user_policy ON macro_tasks
    FOR ALL TO authenticated_user
    USING (user_id = current_user_id() OR user_id IS NULL);

CREATE POLICY macro_logs_user_policy ON macro_execution_logs
    FOR ALL TO authenticated_user
    USING (user_id = current_user_id() OR user_id IS NULL);

CREATE POLICY macro_presets_user_policy ON macro_presets
    FOR ALL TO authenticated_user
    USING (user_id = current_user_id());
*/

-- =====================================
-- 9. 초기 데이터 및 설정
-- =====================================

-- 시스템 설정 테이블 (선택적)
CREATE TABLE IF NOT EXISTS macro_system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 기본 시스템 설정 삽입
INSERT INTO macro_system_config (key, value, description) VALUES
('max_concurrent_tasks', '100', '동시 실행 가능한 최대 매크로 작업 수'),
('default_timeout', '10000', '기본 타임아웃 (밀리초)'),
('max_retry_count', '3', '최대 재시도 횟수'),
('cleanup_interval_days', '30', '작업 정리 주기 (일)')
ON CONFLICT (key) DO NOTHING;

-- =====================================
-- 10. 성능 최적화를 위한 추가 인덱스
-- =====================================

-- 복합 인덱스 (자주 함께 사용되는 컬럼들)
CREATE INDEX IF NOT EXISTS idx_macro_tasks_user_status ON macro_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_macro_logs_user_success ON macro_execution_logs(user_id, success);
CREATE INDEX IF NOT EXISTS idx_macro_logs_url_type ON macro_execution_logs(target_url, macro_type);
CREATE INDEX IF NOT EXISTS idx_macro_logs_time_success ON macro_execution_logs(executed_at, success);

-- 부분 인덱스 (특정 조건의 데이터만)
CREATE INDEX IF NOT EXISTS idx_macro_tasks_scheduled_time 
    ON macro_tasks(optimal_refresh_time) 
    WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_macro_logs_recent_success 
    ON macro_execution_logs(executed_at, response_time) 
    WHERE success = true AND executed_at > CURRENT_TIMESTAMP - INTERVAL '7 days';

-- =====================================
-- 11. 데이터 검증 및 제약 조건
-- =====================================

-- 추가 체크 제약 조건
ALTER TABLE macro_tasks 
ADD CONSTRAINT check_target_time_future 
CHECK (target_time > created_at);

ALTER TABLE macro_tasks 
ADD CONSTRAINT check_optimal_time_before_target 
CHECK (optimal_refresh_time <= target_time);

ALTER TABLE macro_execution_logs 
ADD CONSTRAINT check_response_time_positive 
CHECK (response_time >= 0);

-- =====================================
-- 12. 코멘트 추가
-- =====================================

COMMENT ON TABLE macro_tasks IS '매크로 작업 예약 및 실행 정보';
COMMENT ON TABLE macro_execution_logs IS '매크로 실행 로그 및 결과';
COMMENT ON TABLE macro_presets IS '사용자별 매크로 설정 프리셋';
COMMENT ON TABLE macro_consent_logs IS '매크로 사용 동의 로그';

COMMENT ON COLUMN macro_tasks.optimal_refresh_time IS '계산된 최적 실행 시간';
COMMENT ON COLUMN macro_tasks.settings IS '매크로 실행을 위한 설정 (JSON)';
COMMENT ON COLUMN macro_tasks.user_consent IS '사용자 동의 여부';

COMMENT ON COLUMN macro_execution_logs.response_time IS '응답 시간 (밀리초)';
COMMENT ON COLUMN macro_execution_logs.attempt_number IS '재시도 횟수';

-- 스키마 버전 정보
INSERT INTO macro_system_config (key, value, description) VALUES
('schema_version', '"1.0.0"', '매크로 시스템 스키마 버전')
ON CONFLICT (key) DO UPDATE SET value = '"1.0.0"', updated_at = CURRENT_TIMESTAMP;