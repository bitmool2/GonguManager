'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';
import { Sidebar, MobileSidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <ProjectProvider>
      <SubscriptionProvider>
      <div className="min-h-screen bg-gray-50/50">
        {/* 데스크탑 고정 사이드바 */}
        <Sidebar />

        {/* 모바일 드로어 사이드바 */}
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="lg:pl-64">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="p-6">{children}</main>
        </div>
      </div>
      </SubscriptionProvider>
    </ProjectProvider>
  );
}
