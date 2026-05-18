'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { removeToken } from '@/lib/api';
import { Bell, LogOut, User, Menu } from 'lucide-react';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-4 lg:px-6">
      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      {/* lg 이상에서는 빈 공간 */}
      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <div className="flex items-center gap-2 ml-2 pl-2 border-l">
          <button
            onClick={() => router.push('/mypage')}
            className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
            title="마이페이지"
          >
            <User className="w-4 h-4 text-primary" />
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" />
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}
