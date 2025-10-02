'use client';

import { Bookmark } from '@/types/bookmark';

interface BookmarkItemProps {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: number) => void;
  onCheckTime: (bookmark: Bookmark) => void;
  viewMode: 'grid' | 'list';
}

export default function BookmarkItem({
  bookmark,
  onEdit,
  onDelete,
  onCheckTime,
  viewMode,
}: BookmarkItemProps) {
  const getFaviconUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.origin}/favicon.ico`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(bookmark.custom_url);

  if (viewMode === 'list') {
    return (
      <div 
        className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:border-indigo-500 transition-all cursor-pointer group"
        onClick={() => onCheckTime(bookmark)}
      >
        <div className="flex items-center gap-4">
          {/* 아이콘 */}
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-xl text-white flex-shrink-0"
          >
            {bookmark.favicon && faviconUrl ? (
              <img 
                src={faviconUrl} 
                alt={bookmark.custom_name}
                className="w-8 h-8 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                  if (nextElement) nextElement.style.display = 'block';
                }}
              />
            ) : null}
            <span style={{ display: bookmark.favicon && faviconUrl ? 'none' : 'block' }}>
            </span>
          </div>

          {/* 내용 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {bookmark.custom_name}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {bookmark.custom_url}
            </p>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(bookmark);
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              수정
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(bookmark.id);
              }}
              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div 
      className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center hover:border-indigo-500 transition-all cursor-pointer group"
      onClick={() => onCheckTime(bookmark)}
    >
      {/* 아이콘 */}
      <div 
        className="w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center text-xl text-white"
      >
        {bookmark.favicon && faviconUrl ? (
          <img 
            src={faviconUrl} 
            alt={bookmark.custom_name}
            className="w-8 h-8 rounded"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
              if (nextElement) nextElement.style.display = 'block';
            }}
          />
        ) : null}
        <span style={{ display: bookmark.favicon && faviconUrl ? 'none' : 'block' }}>
        </span>
      </div>

      {/* 제목 */}
      <h3 className="text-base font-semibold text-gray-900 mb-2 truncate">
        {bookmark.custom_name}
      </h3>

      {/* URL */}
      <p className="text-xs text-gray-600 mb-4 break-all">
        {bookmark.custom_url}
      </p>

      {/* 액션 버튼들 */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(bookmark);
          }}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
        >
          수정
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(bookmark.id);
          }}
          className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  );
}