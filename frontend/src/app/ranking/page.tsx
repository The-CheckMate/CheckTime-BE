'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPopularSites, Site } from '@/libs/api/popularSites';
import { EmptyState } from '@/components/RankingEmptyState';

// 랭크(1,2,3위)에 따라 뱃지 색상을 반환하는 헬퍼 함수
const getRankBadgeStyle = (rank: number): React.CSSProperties => {
  if (rank === 1) return { backgroundColor: '#FFD700' };
  if (rank === 2) return { backgroundColor: '#C0C0C0' };
  if (rank === 3) return { backgroundColor: '#CD7F32' };
  return { backgroundColor: '#f0f0f0', color: '#333' };
};

export default function RankingPage() {
  const [sites, setSites] = useState<Site[]>([]);

  const [period, setPeriod] = useState<'realtime' | 'daily' | 'weekly' | 'all'>(
    'realtime',
  );

  // 기간 옵션들
  const periods: (typeof period)[] = ['realtime', 'daily', 'weekly', 'all'];

  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const categories = ['전체', '티켓팅', '대학'];

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // API 함수를 호출하고, 파라미터를 객체 형태로 전달
      const fetchedSites = await getPopularSites({
        period,
        category: activeCategory,
      });

      setSites(fetchedSites);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [period, activeCategory]);

  // 컴포넌트가 처음 렌더링되거나, 필터가 변경될 때 API를 호출
  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* 헤더 */}
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
            🚀 실시간 인기 링크 순위
          </h1>
          <p
            style={{
              color: '#6c757d',
              fontSize: '1.1rem',
              marginTop: '0.5rem',
            }}
          >
            지금 가장 많이 검색되는 티켓팅 사이트를 확인하세요.
          </p>
          <p style={{ color: '#adb5bd', fontSize: '0.9rem' }}></p>
        </header>

        {/* 카테고리 필터 */}
        <nav
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '2rem',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                background: activeCategory === cat ? '#212529' : '#fff',
                color: activeCategory === cat ? '#fff' : '#212529',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* 기간(period) 필터 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '0.25rem 0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                background: period === p ? '#2a2e45' : '#fff',
                color: period === p ? '#fff' : '#212529',
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* 랭킹 리스트 */}
        <main>
          {loading ? (
            <p style={{ textAlign: 'center' }}>로딩 중...</p>
          ) : error ? (
            <p style={{ textAlign: 'center', color: 'red' }}>오류: {error}</p>
          ) : sites.length > 0 ? (
            <div
              style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                padding: '1rem',
              }}
            >
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sites.map((site, index) => (
                  <li
                    key={`site-${site.site_id}-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1.5rem 1rem',
                      borderBottom:
                        index < sites.length - 1 ? '1px solid #f1f3f5' : 'none',
                    }}
                  >
                    {/* 순위 뱃지 */}
                    <div
                      style={{
                        ...getRankBadgeStyle(index + 1),
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        marginRight: '1rem',
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* 사이트 정보 */}
                    <div style={{ flex: 1, marginRight: '1rem' }}>
                      <span
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          display: 'block',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {site.name}
                      </span>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#868e96',
                          textDecoration: 'none',
                          fontSize: '0.9rem',
                        }}
                      >
                        {site.url}
                      </a>
                    </div>

                    {/* 검색 횟수 */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {parseInt(site.click_count, 10).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#868e96' }}>
                        검색 횟수
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  );
}
