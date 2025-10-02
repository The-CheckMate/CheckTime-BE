export interface Bookmark {
  id: number;
  user_id?: number;
  custom_name: string;
  custom_url: string;
  favicon?: string;
  created_at?: string;
  updated_at?: string;
  click_count?: number;
}

export interface BookmarkCreateRequest {
  custom_name: string;
  custom_url: string;
  favicon?: string; // 선택적 필드로 유지 (백엔드에서 사용)
}

export interface BookmarkUpdateRequest {
  custom_name: string;
  custom_url: string;
  favicon?: string;
}

export interface BookmarkFormData {
  custom_name: string;
  custom_url: string;
  favicon?: string;
}
