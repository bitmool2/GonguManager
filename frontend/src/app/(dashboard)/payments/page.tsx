'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { apiFetch, apiUpload } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { CheckCircle, Clock, AlertTriangle, Upload, Link2, Trash2 } from 'lucide-react';

/* ── 타입 정의 ── */
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

interface UploadRecord {
  id: number;
  depositorName: string;
  amount: number;
  status: string;
  uploadedAt: string;
}

interface OrderSummary {
  id: number;
  orderNumber: string;
  customerName: string;
  depositName: string;
  totalPrice: number;
  status: string;
}

interface Summary {
  matched: number;
  pending: number;
  mismatch: number;
}

const paymentStatusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  matched:  { label: '입금완료', variant: 'success' },
  pending:  { label: '미입금',   variant: 'warning' },
  mismatch: { label: '불일치',   variant: 'destructive' },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('ko-KR').format(amount) + '원';

export default function PaymentsPage() {
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [uploadRecords,  setUploadRecords]  = useState<UploadRecord[]>([]);
  const [summary,        setSummary]        = useState<Summary | null>(null);
  const [filter,         setFilter]         = useState('all');
  const [matchDialog,    setMatchDialog]    = useState<Payment | null>(null);
  const [matchName,      setMatchName]      = useState('');
  // 수기매핑 다이얼로그 (UploadRecord → Order)
  const [linkDialog,     setLinkDialog]     = useState<UploadRecord | null>(null);
  const [orderSearch,    setOrderSearch]    = useState('');
  const [orderResults,   setOrderResults]   = useState<OrderSummary[]>([]);
  const [linkLoading,    setLinkLoading]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedProject } = useProject();

  const fetchData = useCallback(async () => {
    const projectParam = selectedProject ? `&projectId=${selectedProject.id}` : '';
    const statusParam  = filter !== 'all' ? `?status=${filter}${projectParam}` : `?${projectParam.slice(1)}`;
    const [p, s, u] = await Promise.all([
      apiFetch<Payment[]>(`/payments${statusParam}`),
      apiFetch<Summary>(`/payments/summary${selectedProject ? `?projectId=${selectedProject.id}` : ''}`),
      apiFetch<UploadRecord[]>('/payments/upload-records'),
    ]);
    setPayments(p);
    setSummary(s);
    setUploadRecords(u);
  }, [filter, selectedProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 입금 완료 처리 ── */
  const handleConfirm = async (id: number) => {
    await apiFetch(`/payments/${id}/confirm`, { method: 'PUT' });
    fetchData();
  };

  /* ── 수동 매칭 (기존 payment mismatch) ── */
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

  /* ── 파일 업로드 ── */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await apiUpload<{
        total: number; matched: number; unmatched: number;
        parsed: number; detectedNameCol: string; detectedAmountCol: string;
      }>('/payments/upload', file);
      alert(
        `업로드 완료\n` +
        `• 입금자 컬럼: ${result.detectedNameCol}\n` +
        `• 금액 컬럼: ${result.detectedAmountCol}\n` +
        `• 파싱: ${result.parsed}건  |  자동매칭: ${result.matched}건  |  미매칭: ${result.unmatched}건\n` +
        (result.unmatched > 0 ? '\n미매칭 건은 [불일치] 탭에서 수기 매핑하세요.' : ''),
      );
      fetchData();
    } catch (err: any) {
      alert(`업로드 오류: ${err.message}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── UploadRecord 주문 검색 ── */
  const handleOrderSearch = async () => {
    if (!orderSearch.trim()) return;
    setLinkLoading(true);
    try {
      const params = new URLSearchParams({ search: orderSearch, page: '1', limit: '10' });
      if (selectedProject) params.set('projectId', String(selectedProject.id));
      const res = await apiFetch<{ orders: OrderSummary[] }>(`/orders?${params}`);
      setOrderResults(res.orders ?? []);
    } finally {
      setLinkLoading(false);
    }
  };

  /* ── UploadRecord 수기 매핑 ── */
  const handleLinkToOrder = async (orderId: number) => {
    if (!linkDialog) return;
    try {
      await apiFetch(`/payments/upload-records/${linkDialog.id}/match`, {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });
      setLinkDialog(null);
      setOrderSearch('');
      setOrderResults([]);
      fetchData();
    } catch (err: any) {
      alert(`매핑 오류: ${err.message}`);
    }
  };

  /* ── UploadRecord 삭제 ── */
  const handleDeleteRecord = async (id: number) => {
    if (!confirm('이 미매칭 레코드를 삭제하시겠습니까?')) return;
    await apiFetch(`/payments/upload-records/${id}`, { method: 'DELETE' });
    fetchData();
  };

  /* 탭 기준 불일치 탭에서만 UploadRecord 노출 */
  const showUploadRecords = filter === 'all' || filter === 'mismatch';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">입금관리</h1>
          <p className="text-muted-foreground">입금 현황을 관리하세요</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            입금내역 업로드
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
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
              <p className="text-sm text-muted-foreground">불일치 / 미매칭</p>
              <p className="text-2xl font-bold">
                {summary?.mismatch ?? 0}
                {uploadRecords.length > 0 && (
                  <span className="text-base font-normal text-muted-foreground ml-1">
                    +{uploadRecords.length}미매칭
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            {[
              { value: 'all',      label: '전체' },
              { value: 'pending',  label: '미입금' },
              { value: 'matched',  label: '입금완료' },
              { value: 'mismatch', label: `불일치${uploadRecords.length > 0 ? ` (+${uploadRecords.length})` : ''}` },
            ].map((f) => (
              <Button key={f.value} variant={filter === f.value ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.value)}>
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── 기존 Payment 목록 ── */}
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
                              <p className="text-xs text-orange-500">~{new Date(payment.vbankExpiry).toLocaleDateString('ko-KR')}</p>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">-</span>}
                      </td>
                      <td className="py-3">{formatCurrency(payment.amount)}</td>
                      <td className="py-3"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {payment.status === 'pending' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => handleConfirm(payment.id)}>입금 완료</Button>
                              <Button variant="ghost" size="sm" onClick={() => { setMatchDialog(payment); setMatchName(payment.depositorName || ''); }}>수동 매칭</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {payments.length === 0 && !showUploadRecords && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">입금 데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── 미매칭 UploadRecord 섹션 ── */}
          {showUploadRecords && uploadRecords.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-orange-50 border-b flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-700">
                  업로드 미매칭 {uploadRecords.length}건 — 주문과 연결되지 않은 입금 내역
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">입금자명</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">금액</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">업로드일시</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadRecords.map((rec) => (
                    <tr key={rec.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{rec.depositorName}</td>
                      <td className="px-4 py-2.5">{formatCurrency(rec.amount)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(rec.uploadedAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setLinkDialog(rec); setOrderSearch(''); setOrderResults([]); }}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            주문 매핑
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRecord(rec.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 수동 매칭 다이얼로그 (기존 Payment mismatch) ── */}
      <Dialog open={!!matchDialog} onOpenChange={() => setMatchDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>수동 입금 매칭</DialogTitle></DialogHeader>
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
              <Label>입금자명 입력</Label>
              <Input value={matchName} onChange={(e) => setMatchName(e.target.value)} placeholder="입금자명을 입력하세요" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialog(null)}>취소</Button>
            <Button onClick={handleManualMatch}>매칭 확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── UploadRecord 수기 매핑 다이얼로그 ── */}
      <Dialog open={!!linkDialog} onOpenChange={() => { setLinkDialog(null); setOrderResults([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>주문 매핑</DialogTitle>
          </DialogHeader>
          {linkDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm space-y-1">
                <p className="font-semibold text-orange-800">미매칭 입금 내역</p>
                <p>입금자: <span className="font-medium">{linkDialog.depositorName}</span></p>
                <p>금액: <span className="font-medium">{formatCurrency(linkDialog.amount)}</span></p>
              </div>

              <div>
                <Label className="text-sm font-medium">주문 검색 (고객명 / 주문번호 / 입금자명)</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="검색어 입력"
                    onKeyDown={(e) => e.key === 'Enter' && handleOrderSearch()}
                  />
                  <Button onClick={handleOrderSearch} disabled={linkLoading} variant="outline">
                    {linkLoading ? '검색 중...' : '검색'}
                  </Button>
                </div>
              </div>

              {orderResults.length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {orderResults.map((order) => (
                    <div key={order.id} className="flex items-center justify-between px-3 py-2.5 border-b last:border-0 hover:bg-muted/40">
                      <div className="text-sm space-y-0.5">
                        <p className="font-mono text-xs text-muted-foreground">{order.orderNumber}</p>
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">입금자: {order.depositName || '-'} | {formatCurrency(order.totalPrice)}</p>
                      </div>
                      <Button size="sm" onClick={() => handleLinkToOrder(order.id)}>매핑</Button>
                    </div>
                  ))}
                </div>
              )}
              {orderResults.length === 0 && orderSearch && !linkLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">검색 결과가 없습니다.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLinkDialog(null); setOrderResults([]); }}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
