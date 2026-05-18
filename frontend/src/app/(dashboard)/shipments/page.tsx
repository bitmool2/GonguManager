'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { Package, Truck, CheckCircle } from 'lucide-react';

interface Shipment {
  id: number;
  orderId: number;
  courier: string | null;
  trackingNumber: string | null;
  status: string;
  shippedAt: string | null;
  order: {
    id: number;
    orderNumber: string;
    customerName: string;
    zipNo?: string;
    addrBase?: string;
    addrDetail?: string;
    status: string;
  };
}

interface Summary {
  pending: number;
  shipping: number;
  completed: number;
}

const shipmentStatusMap: Record<string, { label: string; variant: 'warning' | 'info' | 'success' }> = {
  pending: { label: '배송대기', variant: 'warning' },
  shipping: { label: '배송중', variant: 'info' },
  completed: { label: '배송완료', variant: 'success' },
};

const couriers = [
  'CJ대한통운',
  '한진택배',
  '롯데택배',
  '우체국택배',
  '로젠택배',
  '경동택배',
];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('all');
  const [trackingDialog, setTrackingDialog] = useState<Shipment | null>(null);
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const { selectedProject } = useProject();

  const fetchData = useCallback(async () => {
    const projectParam = selectedProject ? `&projectId=${selectedProject.id}` : '';
    const statusParam = filter !== 'all' ? `?status=${filter}${projectParam}` : `?${projectParam.slice(1)}`;
    const [s, sum] = await Promise.all([
      apiFetch<Shipment[]>(`/shipments${statusParam}`),
      apiFetch<Summary>(`/shipments/summary${selectedProject ? `?projectId=${selectedProject.id}` : ''}`),
    ]);
    setShipments(s);
    setSummary(sum);
  }, [filter, selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegisterTracking = async () => {
    if (!trackingDialog) return;
    await apiFetch(`/shipments/${trackingDialog.id}/tracking`, {
      method: 'PUT',
      body: JSON.stringify({ courier, trackingNumber }),
    });
    setTrackingDialog(null);
    setCourier('');
    setTrackingNumber('');
    fetchData();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await apiFetch(`/shipments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">배송관리</h1>
        <p className="text-muted-foreground">배송 현황을 관리하세요</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">배송대기</p>
              <p className="text-2xl font-bold">{summary?.pending ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">배송중</p>
              <p className="text-2xl font-bold">{summary?.shipping ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">배송완료</p>
              <p className="text-2xl font-bold">{summary?.completed ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            {[
              { value: 'all', label: '전체' },
              { value: 'pending', label: '배송대기' },
              { value: 'shipping', label: '배송중' },
              { value: 'completed', label: '배송완료' },
            ].map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">주문번호</th>
                  <th className="pb-3 font-medium text-muted-foreground">고객명</th>
                  <th className="pb-3 font-medium text-muted-foreground">택배사</th>
                  <th className="pb-3 font-medium text-muted-foreground">송장번호</th>
                  <th className="pb-3 font-medium text-muted-foreground">상태</th>
                  <th className="pb-3 font-medium text-muted-foreground">액션</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => {
                  const isCanceled = shipment.order.status === 'canceled';
                  const s = isCanceled
                    ? { label: '주문취소', variant: 'destructive' as const }
                    : (shipmentStatusMap[shipment.status] || { label: shipment.status, variant: 'warning' as const });
                  return (
                    <tr key={shipment.id} className={`border-b last:border-0 hover:bg-muted/50 ${isCanceled ? 'opacity-50' : ''}`}>
                      <td className={`py-3 font-mono text-xs ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                        {shipment.order.orderNumber}
                      </td>
                      <td className={`py-3 ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                        {shipment.order.customerName}
                      </td>
                      <td className={`py-3 ${isCanceled ? 'text-muted-foreground' : ''}`}>
                        {shipment.courier || '-'}
                      </td>
                      <td className={`py-3 font-mono text-xs ${isCanceled ? 'text-muted-foreground' : ''}`}>
                        {shipment.trackingNumber || '-'}
                      </td>
                      <td className="py-3">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {!isCanceled && shipment.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTrackingDialog(shipment);
                                setCourier(shipment.courier || '');
                                setTrackingNumber(shipment.trackingNumber || '');
                              }}
                            >
                              송장 등록
                            </Button>
                          )}
                          {!isCanceled && shipment.status === 'pending' && shipment.trackingNumber && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(shipment.id, 'shipping')}
                            >
                              배송 시작
                            </Button>
                          )}
                          {!isCanceled && shipment.status === 'shipping' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(shipment.id, 'completed')}
                            >
                              배송 완료
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shipments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      배송 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!trackingDialog} onOpenChange={() => setTrackingDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>송장 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">주문번호</p>
              <p className="font-medium">{trackingDialog?.order.orderNumber}</p>
            </div>
            <div className="space-y-2">
              <Label>택배사</Label>
              <Select value={courier} onValueChange={setCourier}>
                <SelectTrigger>
                  <SelectValue placeholder="택배사 선택" />
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>송장번호</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="송장번호를 입력하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingDialog(null)}>
              취소
            </Button>
            <Button onClick={handleRegisterTracking} disabled={!courier || !trackingNumber}>
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
