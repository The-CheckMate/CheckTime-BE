import { AuthUtils } from '@/libs/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE;

export interface Site {
  id: number;
  url: string;
  name: string;
  category: string;
  description?: string;
  keywords: string[];
  usage_count: number;
  average_rtt: number;
  success_rate: number;
  similarity?: number;
  matchReason?: string;
  isNewlyRegistered?: boolean;
}

export interface SiteSearchResult {
  searchTerm: string;
  results: Site[];
  totalFound: number;
  koreanMapping?: {
    korean_name: string;
    actual_url: string;
    similarity_threshold: number;
  };
  autoDiscovery?: {
    discovered: boolean;
    attempted: boolean;
    newSite?: Site;
    source?: string;
  };
  bestSimilarityFromDb: number;
  searchedAt: string;
}

export interface SiteSearchResponse {
  success: boolean;
  data: SiteSearchResult;
  error?: string;
}

export class SiteAPI {
  /**
   * 사이트 검색 (백엔드 SiteService 활용)
   */
  static async searchSites(
    searchTerm: string, 
    autoDiscover: boolean = true
  ): Promise<SiteSearchResult> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sites/search?q=${encodeURIComponent(searchTerm)}&auto_discover=${autoDiscover}`,
        {
          headers: AuthUtils.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`사이트 검색 실패: ${response.status} ${response.statusText}`);
      }

      const result: SiteSearchResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || '사이트 검색 중 오류가 발생했습니다.');
      }

      return result.data;
    } catch (error) {
      console.error('사이트 검색 API 호출 실패:', error);
      throw new Error('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    }
  }


  /**
   * 모든 사이트 조회 (페이징 지원)
   */
  static async getAllSites(
    page: number = 1,
    limit: number = 20,
    category?: string,
    sortBy: string = 'usage_count'
  ): Promise<{
    sites: Site[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
    });

    if (category) {
      params.append('category', category);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/sites?${params.toString()}`,
      {
        headers: AuthUtils.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('사이트 목록을 가져오는데 실패했습니다.');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '사이트 목록 조회 중 오류가 발생했습니다.');
    }

    return result.data;
  }

  /**
   * 인기 사이트 조회
   */
  static async getPopularSites(
    limit: number = 10,
    category?: string
  ): Promise<Site[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (category) {
      params.append('category', category);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/sites/popular?${params.toString()}`,
      {
        headers: AuthUtils.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('인기 사이트를 가져오는데 실패했습니다.');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '인기 사이트 조회 중 오류가 발생했습니다.');
    }

    return result.data;
  }

  /**
   * 카테고리 목록 조회
   */
  static async getCategories(): Promise<{
    category: string;
    site_count: number;
    avg_success_rate: number;
  }[]> {
    const response = await fetch(`${API_BASE_URL}/api/sites/categories`, {
      headers: AuthUtils.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('카테고리 목록을 가져오는데 실패했습니다.');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '카테고리 목록 조회 중 오류가 발생했습니다.');
    }

    return result.data;
  }

  /**
   * URL 자동 보정 제안
   */
  static async suggestUrlCorrection(inputUrl: string): Promise<{
    inputUrl: string;
    correctedUrl: string | null;
    suggestions: Array<{
      originalUrl: string;
      siteName: string;
      similarity: number;
    }>;
    hasSuggestions: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/sites/suggest-correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthUtils.getAuthHeaders(),
      },
      body: JSON.stringify({ inputUrl }),
    });

    if (!response.ok) {
      throw new Error('URL 보정 제안을 가져오는데 실패했습니다.');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'URL 보정 제안 중 오류가 발생했습니다.');
    }

    return result.data;
  }
}
