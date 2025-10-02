// frontend/lib/api/refreshRecordApi.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

interface RefreshRecord {
  id: number;
  user_id: number;
  site_id: number;
  refresh_time: number;
  user_best_time: number;
  user_average_time: number;
  created_at: string;
}

interface RankingItem {
  user_id: number;
  username: string;
  user_best_time: number;
  user_average_time: number;
  rank: number;
  last_updated: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 반응속도 기록 저장
 */
export async function saveRefreshRecord(refreshTime: number, token: string) {
  const response = await fetch(`${API_BASE_URL}/refresh-records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ refreshTime }),
  });

  if (!response.ok) {
    throw new Error('기록 저장에 실패했습니다');
  }

  return response.json() as Promise<ApiResponse<{
    record: RefreshRecord;
    isNewBest: boolean;
  }>>;
}

/**
 * 순위 조회
 */
export async function getRankings(type: 'best' | 'average' = 'best', limit = 100) {
  const response = await fetch(
    `${API_BASE_URL}/refresh-records/rankings?type=${type}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error('순위 조회에 실패했습니다');
  }

  return response.json() as Promise<ApiResponse<{
    rankings: RankingItem[];
  }>>;
}

/**
 * 내 순위 조회
 */
export async function getMyRank(token: string) {
  const response = await fetch(`${API_BASE_URL}/refresh-records/my-rank`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('내 순위 조회에 실패했습니다');
  }

  return response.json() as Promise<ApiResponse<{
    rank: RankingItem | null;
  }>>;
}

/**
 * 주변 순위 조회
 */
export async function getNearbyRankings(token: string, range = 5) {
  const response = await fetch(
    `${API_BASE_URL}/refresh-records/nearby?range=${range}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('주변 순위 조회에 실패했습니다');
  }

  return response.json() as Promise<ApiResponse<{
    rankings: RankingItem[];
    userRank: RankingItem | null;
  }>>;
}

/**
 * 전체 통계 조회 (비로그인 가능)
 */
export async function getStats(token?: string) {
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/refresh-records/stats`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('통계 조회에 실패했습니다');
  }

  return response.json() as Promise<ApiResponse<{
    topRankings: RankingItem[];
    userStats: RankingItem | null;
  }>>;
}