'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, ShoppingCart, FolderKanban, BadgeDollarSign,
  UserPlus, TrendingUp, RefreshCw,
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
const STATUS_LABELS: Record<string, string> = {
  pending: '대기', paid: '결제완료', shipped: '배송중',
  delivered: '배송완료', cancelled: '취소',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};
const PLAN_COLORS = ['bg-gray-200', 'bg-blue-300', 'bg-purple-300', 'bg-amber-300', 'bg-green-300', 'bg-green-400', 'bg-green-500'];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-gray-500">서비스 전체 현황</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 사용자', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-500', sub: `최근 7일 +${stats.recentUsers}명` },
          { label: '전체 프로젝트', value: stats.totalProjects.toLocaleString(), icon: FolderKanban, color: 'text-purple-500', sub: '전체 공구 수' },
          { label: '전체 주문', value: stats.totalOrders.toLocaleString(), icon: ShoppingCart, color: 'text-green-500', sub: '누적 주문 건수' },
          { label: '누적 매출', value: `${(stats.totalRevenue / 10000).toFixed(1)}만원`, icon: BadgeDollarSign, color: 'text-amber-500', sub: '결제 완료 기준' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-2xl font-bold mt-0.5">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{sub}</p>
                </div>
                <Icon className={`w-8 h-8 ${color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <div className={`h-full rounded-full ${PLAN_COLORS[i % PLAN_COLORS.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 주문 상태 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-green-500" />주문 상태 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.orderStatusCounts.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="text-sm font-bold">{s.count.toLocaleString()}건</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 최근 신규 가입 수 */}
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
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.month}: ${m.count}건`}>
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
