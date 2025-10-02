import {
  Bookmark,
  BookmarkCreateRequest,
  BookmarkUpdateRequest,
} from '@/types/bookmark';
import { AuthUtils } from '@/libs/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE;

export class BookmarkAPI {
  // 북마크 목록 조회
  static async getBookmarks(): Promise<Bookmark[]> {
    const response = await fetch(`${API_BASE_URL}/api/bookmarks`, {
      headers: AuthUtils.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      throw new Error('북마크 목록을 가져오는데 실패했습니다.');
    }

    const result = await response.json();

    // API 응답 구조에 따라 데이터 추출
    if (result.success && result.data) {
      if (Array.isArray(result.data)) {
        return result.data;
      } else {
        return [];
      }
    } else if (Array.isArray(result)) {
      return result;
    } else {
      console.log('북마크 API 응답:', result);
      return [];
    }
  }

  // 북마크 추가
  static async createBookmark(data: BookmarkCreateRequest): Promise<Bookmark> {
    console.log('북마크 추가 요청 데이터:', data);

    const response = await fetch(`${API_BASE_URL}/api/bookmarks`, {
      method: 'POST',
      headers: {
        ...AuthUtils.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    console.log('북마크 추가 응답 상태:', response.status);

    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('북마크 추가 실패 응답:', errorData);

      try {
        const errorJson = JSON.parse(errorData);
        throw new Error(
          errorJson.error ||
            errorJson.message ||
            `북마크 추가에 실패했습니다. (${response.status})`,
        );
      } catch {
        throw new Error(
          `북마크 추가에 실패했습니다. (${response.status}): ${errorData}`,
        );
      }
    }

    const result = await response.json();
    console.log('북마크 추가 성공 응답:', result);

    // 추가는 { success: true, data: {...} } 형태로 반환
    if (result.success && result.data) {
      return result.data;
    }

    throw new Error('북마크 추가 응답 형식이 올바르지 않습니다.');
  }

  // 북마크 수정
  static async updateBookmark(
    id: number,
    data: BookmarkUpdateRequest,
  ): Promise<Bookmark> {
    console.log('북마크 수정 요청 데이터:', data);
    
    const response = await fetch(`${API_BASE_URL}/api/bookmarks/${id}`, {
      method: 'PUT',
      headers: {
        ...AuthUtils.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('북마크 수정 실패 응답:', errorData);
      
      try {
        const errorJson = JSON.parse(errorData);
        throw new Error(
          errorJson.error ||
            errorJson.message ||
            `북마크 수정에 실패했습니다. (${response.status})`,
        );
      } catch {
        throw new Error(
          `북마크 수정에 실패했습니다. (${response.status}): ${errorData}`,
        );
      }
    }

    const result = await response.json();
    console.log('북마크 수정 응답:', result);

    // 다양한 응답 형식 처리
    if (result.success) {
      if (result.data) {
        // { success: true, data: {} } 형태
        return result.data;
      } else if (Array.isArray(result)) {
        // 배열 형태로 직접 반환된 경우
        return result[0];
      } else if (result.id) {
        // 직접 북마크 객체가 반환된 경우
        return result;
      }
    } else if (result.id) {
      // success 없이 직접 북마크 객체가 반환된 경우
      return result;
    } else if (Array.isArray(result) && result.length > 0) {
      // 배열로 직접 반환된 경우
      return result[0];
    }

    console.error('북마크 수정 응답 형식 오류:', result);
    throw new Error('북마크 수정 응답 형식이 올바르지 않습니다.');
  }

  // 북마크 삭제
  static async deleteBookmark(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/bookmarks/${id}`, {
      method: 'DELETE',
      headers: AuthUtils.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      throw new Error('북마크 삭제에 실패했습니다.');
    }

    const result = await response.json();

    // 삭제는 { success: true, data: [...] } 형태로 반환하지만 성공이면 OK
    if (!result.success) {
      throw new Error('북마크 삭제에 실패했습니다.');
    }
  }

  // 북마크 클릭 (조회수 증가)
  static async clickBookmark(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/bookmarks/${id}/click`, {
      headers: AuthUtils.getAuthHeaders(),
    });

    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      throw new Error('북마크 클릭 처리에 실패했습니다.');
    }

    const result = await response.json();

    // 클릭은 검색 결과를 반환하므로 성공 여부만 확인
    if (!result.success) {
      throw new Error('북마크 클릭 처리에 실패했습니다.');
    }
  }
}
