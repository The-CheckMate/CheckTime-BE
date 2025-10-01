'use client';

// 데이터 없음을 안내하는 UI 컴포넌트
export const EmptyState = () => {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '4rem 2rem',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      <span style={{ fontSize: '4rem' }}>텅~</span>
      <h2 style={{ marginTop: '1rem', fontWeight: 'bold' }}>
        아직 집계된 기록이 없어요
      </h2>
      <p style={{ color: '#6c757d', fontSize: '1rem' }}>
        사용자들이 사이트를 검색하면 이곳에 실시간 순위가 표시됩니다.
      </p>
    </div>
  );
};
