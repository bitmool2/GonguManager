'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  Truck,
  Package,
  FolderKanban,
  ChevronDown,
  Plus,
  X,
  UserCircle,
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useState } from 'react';

const navigation = [
  { name: '프로젝트', href: '/projects', icon: FolderKanban },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: '주문관리', href: '/orders', icon: ShoppingCart },
  { name: '입금관리', href: '/payments', icon: CreditCard },
  { name: '배송관리', href: '/shipments', icon: Truck },
  { name: '마이페이지', href: '/mypage', icon: UserCircle },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-400',
  draft: 'bg-yellow-400',
  closed: 'bg-gray-400',
};

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { projects, selectedProject, setSelectedProject } = useProject();
  const { planType } = useSubscription();
  const [open, setOpen] = useState(false);

  const planLabels: Record<string, string> = {
    free: '프리',
    basic: '베이직',
    pro: '프로',
    biz: '비즈',
    pass_1: '1회권',
    pass_3: '3회권',
    pass_10: '10회권',
  };
  const planColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600',
    basic: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    biz: 'bg-amber-100 text-amber-700',
    pass_1: 'bg-green-100 text-green-700',
    pass_3: 'bg-green-100 text-green-700',
    pass_10: 'bg-green-100 text-green-700',
  };

  return (
    <>
      <div className="flex items-center justify-between h-16 px-6 border-b flex-shrink-0">
        <Link href="/projects" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Package className="w-7 h-7 text-primary" />
          <span className="text-lg font-bold text-primary">공구매니저</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${planColors[planType] ?? planColors.free}`}>
            {planLabels[planType] ?? planType}
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* 프로젝트 스위처 */}
      <div className="px-3 py-3 border-b flex-shrink-0">
        <p className="text-xs text-muted-foreground px-2 mb-1">현재 공구</p>
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors text-left"
          >
            <div
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                selectedProject
                  ? statusColors[selectedProject.status] || 'bg-gray-400'
                  : 'bg-gray-300',
              )}
            />
            <span className="text-sm font-medium flex-1 truncate">
              {selectedProject ? selectedProject.name : '프로젝트 없음'}
            </span>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProject(project);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                    selectedProject?.id === project.id && 'bg-primary/5 text-primary',
                  )}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      statusColors[project.status] || 'bg-gray-400',
                    )}
                  />
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {project._count?.activeOrders ?? project._count?.orders ?? 0}건
                  </span>
                </button>
              ))}
              <Link
                href="/projects/new"
                onClick={() => { setOpen(false); onClose?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 border-t"
              >
                <Plus className="w-4 h-4" />
                새 프로젝트 만들기
              </Link>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r z-30">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />
      {/* drawer */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r z-50 flex flex-col lg:hidden">
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  );
}
