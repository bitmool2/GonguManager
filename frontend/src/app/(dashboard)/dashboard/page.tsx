'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import {
  ShoppingCart,
  CreditCard,
  Truck,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface DashboardStats {
  todayOrders: number;
  pendingPayments: number;
  pendingShipments: number;
  totalRevenue: number;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  items: { product: { name: string } }[];
  status: string;
  createdAt: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  pending: { label: '주문완료', variant: 'secondary' },
  paid: { label: '입금완료', variant: 'info' },
  preparing: { label: '준비중', variant: 'warning' },
  shipping: { label: '배송중', variant: 'default' },
  completed: { label: '배송완료', variant: 'success' },
  canceled: { label: '취소', variant: 'destructive' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const { selectedProject } = useProject();

  useEffect(() => {
    const projectParam = selectedProject ? `?projectId=${selectedProject.id}` : '';
    apiFetch<DashboardStats>(`/orders/dashboard${projectParam}`).then(setStats);
    apiFetch<Order[]>(`/orders/recent${projectParam}`).then(setRecentOrders);
  }, [selectedProject]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {selectedProject ? `[${selectedProject.name}] 운영 현황` : '전체 운영 현황'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 주문수</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayOrders ?? '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">입금 대기</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.pendingPayments ?? '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">배송 대기</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.pendingShipments ?? '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 매출</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats ? formatCurrency(stats.totalRevenue) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {(stats?.pendingPayments ?? 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800">미입금 알림</p>
              <p className="text-sm text-orange-600">
                {stats?.pendingPayments}건의 미입금 주문이 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">최근 주문</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">주문번호</th>
                  <th className="pb-3 font-medium text-muted-foreground">고객명</th>
                  <th className="pb-3 font-medium text-muted-foreground">상품</th>
                  <th className="pb-3 font-medium text-muted-foreground">상태</th>
                  <th className="pb-3 font-medium text-muted-foreground">주문일</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const s = statusMap[order.status] || { label: order.status, variant: 'outline' as const };
                  return (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-3 font-mono text-xs">{order.orderNumber}</td>
                      <td className="py-3">{order.customerName}</td>
                      <td className="py-3">
                        {order.items?.[0]?.product?.name || '-'}
                      </td>
                      <td className="py-3">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  );
                })}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      주문 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
