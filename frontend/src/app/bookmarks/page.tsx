'use client';

import { useState, useEffect } from 'react';
import { Bookmark, BookmarkFormData } from '@/types/bookmark';
import { BookmarkAPI } from '@/libs/api/bookmarks';
import { RefreshRecordsAPI } from '@/libs/api/refreshRecords';
import BookmarkItem from '@/components/bookmarks/BookmarkItem';
import BookmarkModal from '@/components/bookmarks/BookmarkModal';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Auth states
  const [isAuthed, setIsAuthed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | undefined>();
  const [modalLoading, setModalLoading] = useState(false);

  // 새로고침 시에도 로그인 유지
  useEffect(() => {
    const at = localStorage.getItem('accessToken');
    if (at) {
      setIsAuthed(true);
      loadBookmarks();
    } else {
      setLoading(false);
    }
  }, []);

  // 로컬스토리지의 새로고침 기록을 DB에 동기화
  useEffect(() => {
    if (isAuthed && bookmarks.length > 0) {
      syncRefreshRecordsToDB();
    }
  }, [isAuthed, bookmarks]);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await BookmarkAPI.getBookmarks();
      setBookmarks(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '북마크를 불러오는데 실패했습니다.';
      if (msg.includes('로그인이 필요')) {
        // 만료 토큰 정리 및 로그인 유도
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userName');
        setIsAuthed(false);
        setBookmarks([]);
        alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // 로컬스토리지의 새로고침 기록을 DB에 동기화하는 함수
  const syncRefreshRecordsToDB = async () => {
    try {
      // 각 북마크에 대해 로컬 기록 확인
      for (const bookmark of bookmarks) {
        const urlKey = `refresh_times_${bookmark.custom_url}`;
        const localData = localStorage.getItem(urlKey);
        
        if (!localData) continue;
        
        try {
          const times = JSON.parse(localData);
          if (Array.isArray(times) && times.length > 0) {
            // 가장 최근 기록을 DB에 저장
            const latestTime = times[times.length - 1];
            
            // site_id를 URL로 찾아야 함 (실제로는 sites API를 통해 가져와야 함)
            // 여기서는 임시로 bookmark id를 사용
            await RefreshRecordsAPI.saveRecord(bookmark.id, latestTime);
            console.log(`✅ ${bookmark.custom_name}의 기록이 DB에 동기화되었습니다.`);
          }
        } catch (parseError) {
          console.error(`${bookmark.custom_name} 기록 동기화 실패:`, parseError);
        }
      }
    } catch (error) {
      console.error('전체 기록 동기화 실패:', error);
    }
  };

  // 검색 필터링
  const filteredBookmarks = bookmarks.filter((bookmark) => {
    const query = searchQuery.toLowerCase();
    return (
      bookmark.custom_name.toLowerCase().includes(query) ||
      bookmark.custom_url.toLowerCase().includes(query)
    );
  });

  // 북마크 추가
  const handleAdd = () => {
    if (!isAuthed) {
      alert('로그인이 필요합니다.');
      return;
    }
    setEditingBookmark(undefined);
    setIsModalOpen(true);
  };

  // 북마크 수정
  const handleEdit = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setIsModalOpen(true);
  };

  // 북마크 삭제
  const handleDelete = async (id: number) => {
    if (confirm('이 북마크를 삭제하시겠습니까?')) {
      try {
        await BookmarkAPI.deleteBookmark(id);
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : '북마크 삭제에 실패했습니다.');
      }
    }
  };

  // 북마크 시간 확인 (확인 모달 표시)
  const handleCheckTime = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setConfirmOpen(true);
  };

  // 실제 시간 확인 실행
  const executeCheckTime = async () => {
    if (!selectedBookmark) return;
    
    try {
      await BookmarkAPI.clickBookmark(selectedBookmark.id);
      
      // 시간 확인 결과를 새 창에서 열기
      const resultWindow = window.open(
        `/search-result?url=${encodeURIComponent(selectedBookmark.custom_url)}&bookmarkId=${selectedBookmark.id}`,
        '_blank'
      );
      
      // 새 창에서 시간 측정이 완료되면 DB에 저장하도록 메시지 리스너 추가
      if (resultWindow) {
        window.addEventListener('message', async (event) => {
          if (event.data.type === 'REFRESH_TIME_RECORDED') {
            const { siteId, refreshTime } = event.data;
            try {
              await RefreshRecordsAPI.saveRecord(siteId, refreshTime);
              console.log('✅ 새로고침 기록이 DB에 저장되었습니다!');
            } catch (error) {
              console.error('기록 저장 실패:', error);
            }
          }
        });
      }
      
      setConfirmOpen(false);
      setSelectedBookmark(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '시간 확인에 실패했습니다.');
      setConfirmOpen(false);
      setSelectedBookmark(null);
    }
  };

  // 모달 제출
  const handleModalSubmit = async (data: BookmarkFormData) => {
    setModalLoading(true);
    try {
      if (editingBookmark) {
        // 수정
        const updated = await BookmarkAPI.updateBookmark(editingBookmark.id, data);
        setBookmarks((prev) =>
          prev.map((b) => (b.id === editingBookmark.id ? updated : b)),
        );
      } else {
        // 추가
        const created = await BookmarkAPI.createBookmark(data);
        setBookmarks((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.',
      );
    } finally {
      setModalLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* 컨트롤 바 */}
        <div className="flex justify-between items-center mb-8 gap-6">
          <div className="relative max-w-md flex-1">
            <input
              type="text"
              className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
              placeholder="북마크 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-5 items-center">
            <div className="flex bg-white border border-gray-200 rounded-lg p-1 gap-1">
              <button
                className={`px-3 py-2 border-none rounded-md cursor-pointer transition-all text-sm font-medium ${
                  viewMode === 'grid'
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                }`}
                onClick={() => setViewMode('grid')}
              >
                카드
              </button>
              <button
                className={`px-3 py-2 border-none rounded-md cursor-pointer transition-all text-sm font-medium ${
                  viewMode === 'list'
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                }`}
                onClick={() => setViewMode('list')}
              >
                리스트
              </button>
            </div>
            
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-black/80 transition-all"
            >
              ➕ 북마크 추가
            </button>
          </div>
        </div>

        {/* 북마크 컨테이너 */}
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          {!isAuthed ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-4">🔒</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                로그인이 필요합니다
              </h3>
              <p className="text-gray-600 mb-4">북마크 기능을 사용하려면 로그인해주세요</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={loadBookmarks}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? '검색 결과가 없습니다' : '아직 북마크가 없습니다'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery ? '다른 검색어를 시도해보세요' : '첫 번째 북마크를 추가해보세요!'}
              </p>
            </div>
          ) : (
            <div className={`grid gap-5 ${
              viewMode === 'grid'
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            }`}>
              {filteredBookmarks.map((bookmark) => (
                <BookmarkItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onCheckTime={handleCheckTime}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 북마크 추가/수정 모달 */}
      <BookmarkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookmark={editingBookmark}
        onSubmit={handleModalSubmit}
        isLoading={modalLoading}
      />


      {/* 시간확인 확인 모달 */}
      <ConfirmModal
        open={confirmOpen}
        title="시간 확인"
        message={`"${selectedBookmark?.custom_name}" 사이트의 시간을 확인하시겠습니까?`}
        confirmText="확인"
        cancelText="취소"
        onConfirm={executeCheckTime}
        onClose={() => {
          setConfirmOpen(false);
          setSelectedBookmark(null);
        }}
      />

    </div>
  );
}