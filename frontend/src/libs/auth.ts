// JWT 토큰 관련 유틸리티 함수들

export const AuthUtils = {
  // 토큰 가져오기
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  },

  // 토큰 저장
  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', token);
  },

  // 토큰 삭제
  removeToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userName');
  },

  // 토큰이 있는지 확인
  hasToken(): boolean {
    return !!this.getToken();
  },

  // 인증 헤더 생성
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  },
};
