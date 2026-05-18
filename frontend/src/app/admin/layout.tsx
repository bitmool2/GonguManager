'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getRoleFromToken, getUserEmailFromToken } from '@/lib/api';
import {
  LayoutDashboard, Users, ShoppingCart, FolderKanban,
  CreditCard, Truck, Shield, LogOut, ChevronRight,
} from 'lucide-react';

const NAV = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: '사용자 관리', icon: Users },
  { href: '/admin/orders', label: '주문', icon: ShoppingCart },
  { href: '/admin/projects', label: '프로젝트', icon: FolderKanban },
  { href: '/admin/payments', label: '결제', icon: CreditCard },
  { href: '/admin/shipments', label: '배송', icon: Truck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const role = getRoleFromToken();
    if (role !== 'admin') {
      router.replace('/projects');
      return;
    }
    setEmail(getUserEmailFromToken() ?? '');
  }, [router]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 사이드바 */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <Shield className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-sm font-bold text-gray-900">관리자</p>
            <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{email}</p>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(({ href, label, icon: Icon, exact }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(href, exact)
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {isActive(href, exact) && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-1">
          <Link href="/projects"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />셀러 대시보드로
          </Link>
          <button
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
