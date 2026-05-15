'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiFetch, apiUpload } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { CheckCircle, Clock, AlertTriangle, Upload } from 'lucide-react';

interface Payment {
  id: number;
  orderId: number;
  depositorName: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
  vbankNum: string | null;
  vbankName: string | null;
  vbankHolder: string | null;
  vbankExpiry: string | null;
  order: {
    id: number;
    orderNumber: string;
    customerName: string;
    depositName: string;
    totalPrice: number;
    status: string;
  };
}

interface Summary {
  matched: number;
  pending: number;
  mismatch: number;
}

const paymentStatusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  matched: { label: '입금완료', variant: 'success' },
  pending: { label: '미입금', variant: 'warning' },
  mismatch: { label: '불일치', variant: 'destructive' },
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('all');
  const [matchDialog, setMatchDialog] = useState<Payment | null>(null);
  const [matchName, setMatchName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedProject } = useProject();

  const fetchData = useCallback(async () => {
    const projectParam = selectedProject ? `&projectId=${selectedProject.id}` : '';
    const statusParam = filter !== 'all' ? `?status=${filter}${projectParam}` : `?${projectParam.slice(1)}`;
    const [p, s] = await Promise.all([
      apiFetch<Payment[]>(`/payments${statusParam}`),
      apiFetch<Summary>(`/payments/summary${selectedProject ? `?projectId=${selectedProject.id}` : ''}`),
    ]);
    setPayments(p);
    setSummary(s);
  }, [filter, selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirm = async (id: number) => {
    await apiFetch(`/payments/${id}/confirm`, { method: 'PUT' });
    fetchData();
  };

  const handleManualMatch = async () => {
    if (!matchDialog) return;
    await apiFetch(`/payments/${matchDialog.id}/match`, {
      method: 'PUT',
      body: JSON.stringify({ depositorName: matchName }),
    });
    setMatchDialog(null);
    setMatchName('');
    fetchData();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await apiUpload('/payments/upload', file);
    fetchData();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR').format(amount) + '원';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">입금관리</h1>
          <p className="text-muted-foreground">입금 현황을 관리하세요</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            입금내역 업로드
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">입금 완료</p>
              <p className="text-2xl font-bold">{summary?.matched ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">미입금</p>
              <p className="text-2xl font-bold">{summary?.pending ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">불일치</p>
              <p className="text-2xl font-bold">{summary?.mismatch ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            {[
              { value: 'all', label: '전체' },
              { value: 'pending', label: '미입금' },
              { value: 'matched', label: '입금완료' },
              { value: 'mismatch', label: '불일치' },
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
                  <th className="pb-3 font-medium text-muted-foreground">주문자명</th>
                  <th className="pb-3 font-medium text-muted-foreground">입금자명</th>
                  <th className="pb-3 font-medium text-muted-foreground">가상계좌</th>
                  <th className="pb-3 font-medium text-muted-foreground">금액</th>
                  <th className="pb-3 font-medium text-muted-foreground">상태</th>
                  <th className="pb-3 font-medium text-muted-foreground">액션</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const s = paymentStatusMap[payment.status] || { label: payment.status, variant: 'warning' as const };
                  return (
                    <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 font-mono text-xs">{payment.order.orderNumber}</td>
                      <td className="py-3">{payment.order.customerName}</td>
                      <td className="py-3">{payment.depositorName || '-'}</td>
                      <td className="py-3">
                        {payment.vbankNum ? (
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs font-medium">{payment.vbankNum}</p>
                            <p className="text-xs text-muted-foreground">{payment.vbankName}</p>
                            {payment.vbankExpiry && (
                              <p className="text-xs text-orange-500">
                                ~{new Date(payment.vbankExpiry).toLocaleDateString('ko-KR')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3">{formatCurrency(payment.amount)}</td>
                      <td className="py-3">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {payment.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfirm(payment.id)}
                              >
                                입금 완료
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setMatchDialog(payment);
                                  setMatchName(payment.depositorName || '');
                                }}
                              >
                                수동 매칭
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      입금 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!matchDialog} onOpenChange={() => setMatchDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수동 입금 매칭</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">주문번호</p>
              <p className="font-medium">{matchDialog?.order.orderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">기대 입금자명</p>
              <p className="font-medium">{matchDialog?.order.depositName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">입금자명 입력</p>
              <Input
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                placeholder="입금자명을 입력하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialog(null)}>
              취소
            </Button>
            <Button onClick={handleManualMatch}>매칭 확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
