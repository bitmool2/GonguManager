'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, ShoppingCart, FolderKanban, BadgeDollarSign,
  UserPlus, TrendingUp, RefreshCw, ChevronRight,
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalOrders: number;
  totalRevenue: number;
  recentUsers: number;
  planCounts: { planType: string; count: number }[];
  orderStatusCounts: { status: string; count: number }[];
  monthlyOrders: { month: string; count: number }[];
}

const PLAN_LABELS: Record<string, string> = {
  free: '프리', basic: '베이직', pro: '프로', biz: '비즈',
  pass_1: '1회권', pass_3: '3회권', pass_10: '10회권',
};
const PLAN_COLORS = ['bg-gray-200', 'bg-blue-300', 'bg-purple-300', 'bg-amber-300', 'bg-green-300', 'bg-green-400', 'bg-green-500'];

const KPI = [
  { label: '전체 사용자', key: 'totalUsers' as const, icon: Users, color: 'text-blue-500', href: '/admin/users' },
  { label: '전체 프로젝트', key: 'totalProjects' as const, icon: FolderKanban, color: 'text-purple-500', href: '/admin/projects' },
  { label: '전체 주문', key: 'totalOrders' as const, icon: ShoppingCart, color: 'text-green-500', href: '/admin/orders' },
  { label: '누적 매출', key: 'totalRevenue' as const, icon: BadgeDollarSign, color: 'text-amber-500', href: '/admin/payments' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>('/admin/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats) return <p className="text-sm text-gray-500">데이터를 불러올 수 없습니다.</p>;

  const maxMonthly = Math.max(...stats.monthlyOrders.map((m) => m.count), 1);

  const formatValue = (key: keyof Stats, val: number) =>
    key === 'totalRevenue'
      ? `${(val / 10000).toFixed(1)}만원`
      : val.toLocaleString();

  const subLabel = (key: keyof Stats) => {
    if (key === 'totalUsers') return `최근 7일 +${stats.recentUsers}명`;
    if (key === 'totalRevenue') return '결제 완료 기준';
    return '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-gray-500">서비스 전체 현황</p>
      </div>

      {/* KPI 카드 — 클릭 시 상세 페이지 이동 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI.map(({ label, key, icon: Icon, color, href }) => (
          <Link key={key} href={href}>
            <Card className="hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      {label}
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-2xl font-bold mt-0.5">
                      {formatValue(key, stats[key] as number)}
                    </p>
                    {subLabel(key) && (
                      <p className="text-xs text-gray-400 mt-1">{subLabel(key)}</p>
                    )}
                  </div>
                  <Icon className={`w-8 h-8 ${color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 플랜 분포 + 월별 주문 추이 (2열) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 플랜 분포 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-blue-500" />플랜별 사용자 분포
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.planCounts.map((p, i) => {
              const total = stats.planCounts.reduce((s, c) => s + c.count, 0) || 1;
              const pct = Math.round((p.count / total) * 100);
              return (
                <div key={p.planType}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium">{PLAN_LABELS[p.planType] ?? p.planType}</span>
                    <span className="text-gray-500">{p.count}명 ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${PLAN_COLORS[i % PLAN_COLORS.length]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 월별 주문 추이 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-purple-500" />월별 주문 추이 (최근 12개월)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.monthlyOrders.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">데이터 없음</p>
            ) : (
              <div className="flex items-end gap-1 h-28">
                {stats.monthlyOrders.map((m) => {
                  const h = Math.round((m.count / maxMonthly) * 100);
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center gap-0.5"
                      title={`${m.month}: ${m.count}건`}
                    >
                      <span className="text-[9px] text-gray-400">{m.count}</span>
                      <div className="w-full bg-blue-400 rounded-sm" style={{ height: `${Math.max(h, 4)}%` }} />
                      <span className="text-[8px] text-gray-400">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
