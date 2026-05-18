'use client';

import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Search, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react';

interface OrderItem {
  product: { name: string };
  option?: { optionName: string };
  quantity: number;
  price: number;
}

interface Payment {
  status: string;
  amount: number;
  depositorName: string | null;
  paidAt: string | null;
  impUid: string | null;
  vbankNum: string | null;
  vbankName: string | null;
  vbankHolder: string | null;
  vbankExpiry: string | null;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  zipNo?: string;
  addrBase?: string;
  addrDetail?: string;
  depositName: string;
  memo: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
  payment?: Payment;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
}

/* ── 옵션별 수량 집계 ── */
interface OptionSummary {
  productName: string;
  optionName: string;
  totalQty: number;
  totalAmount: number;
}

const statusFilters = [
  { value: 'all',       label: '전체' },
  { value: 'pending',   label: '주문완료' },
  { value: 'paid',      label: '입금완료' },
  { value: 'preparing', label: '준비중' },
  { value: 'shipping',  label: '배송중' },
  { value: 'completed', label: '배송완료' },
  { value: 'canceled',  label: '취소' },
];

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  pending:   { label: '주문완료', variant: 'secondary' },
  paid:      { label: '입금완료', variant: 'info' },
  preparing: { label: '준비중',   variant: 'warning' },
  shipping:  { label: '배송중',   variant: 'default' },
  completed: { label: '배송완료', variant: 'success' },
  canceled:  { label: '취소',     variant: 'destructive' },
};

function buildOptionSummary(orders: Order[]): OptionSummary[] {
  const map = new Map<string, OptionSummary>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const productName = item.product?.name ?? '-';
      const optionName  = item.option?.optionName ?? '옵션 없음';
      const key         = `${productName}__${optionName}`;
      if (!map.has(key)) {
        map.set(key, { productName, optionName, totalQty: 0, totalAmount: 0 });
      }
      const row = map.get(key)!;
      row.totalQty    += item.quantity;
      row.totalAmount += item.price;
    }
  }
  return Array.from(map.values());
}

export default function OrdersPage() {
  const { can } = useSubscription();
  const canExcel = can('excelDownload');

  const [data,          setData]          = useState<OrdersResponse | null>(null);
  const [status,        setStatus]        = useState('all');
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [allOrders,     setAllOrders]     = useState<Order[]>([]);
  const [downloading,   setDownloading]   = useState(false);
  const { selectedProject } = useProject();

  /* ── 페이지 단위 목록 ── */
  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (search)           params.set('search', search);
    if (selectedProject)  params.set('projectId', String(selectedProject.id));
    params.set('page',  String(page));
    params.set('limit', '20');
    const res = await apiFetch<OrdersResponse>(`/orders?${params}`);
    setData(res);
  }, [status, search, page, selectedProject]);

  /* ── 탭 전체 데이터 (옵션 요약용) ── */
  const fetchAllForSummary = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (selectedProject)  params.set('projectId', String(selectedProject.id));
    const res = await apiFetch<Order[]>(`/orders/export?${params}`);
    setAllOrders(Array.isArray(res) ? res : []);
  }, [status, selectedProject]);

  useEffect(() => { fetchOrders(); },         [fetchOrders]);
  useEffect(() => { fetchAllForSummary(); },  [fetchAllForSummary]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    await apiFetch(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchOrders();
    await fetchAllForSummary();
    if (newStatus === 'canceled') {
      setSelectedOrder(null);
    } else if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  /* ── 엑셀 다운로드 ── */
  const handleExcelDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (selectedProject)  params.set('projectId', String(selectedProject.id));
      const orders = await apiFetch<Order[]>(`/orders/export?${params}`);

      const wb = XLSX.utils.book_new();

      /* ── 시트 1: 전체 주문 (주문일시 오름차순) ── */
      const sheet1Rows: (string | number)[][] = [
        ['주문번호', '주문일시', '고객명', '연락처', '우편번호', '도로명주소', '상세주소', '입금자명', '상품명', '옵션', '수량', '단가', '상품금액', '총금액', '주문상태', '입금상태', '메모'],
      ];
      for (const order of orders) {
        const items = order.items ?? [];
        if (items.length === 0) {
          sheet1Rows.push([
            order.orderNumber,
            new Date(order.createdAt).toLocaleString('ko-KR'),
            order.customerName,
            order.phone,
            order.zipNo || '',
            order.addrBase || '',
            order.addrDetail || '',
            order.depositName || '',
            '', '', '', '', '',
            order.totalPrice,
            statusMap[order.status]?.label ?? order.status,
            order.payment?.status ?? '',
            order.memo || '',
          ]);
        } else {
          items.forEach((item, idx) => {
            sheet1Rows.push([
              idx === 0 ? order.orderNumber : '',
              idx === 0 ? new Date(order.createdAt).toLocaleString('ko-KR') : '',
              idx === 0 ? order.customerName : '',
              idx === 0 ? order.phone : '',
              idx === 0 ? (order.zipNo || '') : '',
              idx === 0 ? (order.addrBase || '') : '',
              idx === 0 ? (order.addrDetail || '') : '',
              idx === 0 ? (order.depositName || '') : '',
              item.product?.name ?? '',
              item.option?.optionName ?? '',
              item.quantity,
              Math.round(item.price / item.quantity),
              item.price,
              idx === 0 ? order.totalPrice : '',
              idx === 0 ? (statusMap[order.status]?.label ?? order.status) : '',
              idx === 0 ? (order.payment?.status ?? '') : '',
              idx === 0 ? (order.memo || '') : '',
            ]);
          });
        }
      }
      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
      ws1['!cols'] = [
        { wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 30 },
        { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 6 },  { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, '전체주문');

      /* ── 시트 2: 옵션별 발주 집계 ── */
      const summary = buildOptionSummary(orders);
      const sheet2Rows: (string | number)[][] = [
        ['상품명', '옵션', '총 수량', '총 금액'],
        ...summary.map((r) => [r.productName, r.optionName, r.totalQty, r.totalAmount]),
      ];
      // 합계 행
      const totalQty    = summary.reduce((s, r) => s + r.totalQty,    0);
      const totalAmount = summary.reduce((s, r) => s + r.totalAmount, 0);
      sheet2Rows.push(['합계', '', totalQty, totalAmount]);

      const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
      ws2['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, '옵션별주문내역');

      const tabLabel = statusFilters.find((f) => f.value === status)?.label ?? '전체';
      const projectLabel = selectedProject?.name ?? '전체';
      const dateStr = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '');
      XLSX.writeFile(wb, `주문_${projectLabel}_${tabLabel}_${dateStr}.xlsx`);
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR').format(amount) + '원';

  const optionSummary = buildOptionSummary(allOrders.filter((o) => o.status !== 'canceled' || status === 'canceled'));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">주문관리</h1>
        <p className="text-muted-foreground">주문 현황을 관리하세요</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-2 flex-wrap">
              {statusFilters.map((f) => (
                <Button
                  key={f.value}
                  variant={status === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatus(f.value); setPage(1); }}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="고객명, 주문번호 검색"
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={canExcel ? handleExcelDownload : () => alert('엑셀 다운로드는 베이직 이상 플랜에서 사용 가능합니다.\n마이페이지에서 플랜을 업그레이드해주세요.')}
                disabled={downloading}
                className={`whitespace-nowrap ${!canExcel ? 'opacity-50' : ''}`}
                title={canExcel ? undefined : '베이직 이상 플랜 필요'}
              >
                <Download className="h-4 w-4 mr-1.5" />
                {downloading ? '생성 중...' : '엑셀 다운로드'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── 옵션별 수량 요약 ── */}
          {optionSummary.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                옵션별 수량 요약
                <span className="ml-1 font-normal">
                  ({statusFilters.find((f) => f.value === status)?.label ?? '전체'} 기준
                  {status !== 'canceled' ? ', 취소 제외' : ''})
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {optionSummary.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs bg-background border rounded px-2.5 py-1">
                    <span className="font-medium">{row.productName}</span>
                    {row.optionName !== '옵션 없음' && (
                      <span className="text-muted-foreground">/ {row.optionName}</span>
                    )}
                    <span className="ml-1 font-bold text-primary">{row.totalQty}개</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 주문 목록 ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">주문번호</th>
                  <th className="pb-3 font-medium text-muted-foreground">주문일</th>
                  <th className="pb-3 font-medium text-muted-foreground">고객명</th>
                  <th className="pb-3 font-medium text-muted-foreground">구매항목</th>
                  <th className="pb-3 font-medium text-muted-foreground">금액</th>
                  <th className="pb-3 font-medium text-muted-foreground">상태</th>
                  <th className="pb-3 font-medium text-muted-foreground">액션</th>
                </tr>
              </thead>
              <tbody>
                {data?.orders.map((order) => {
                  const s = statusMap[order.status] || { label: order.status, variant: 'outline' as const };
                  const isCanceled = order.status === 'canceled';
                  return (
                    <tr
                      key={order.id}
                      className={`border-b last:border-0 hover:bg-muted/50 ${isCanceled ? 'opacity-50' : ''}`}
                    >
                      <td className={`py-3 font-mono text-xs ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                        {order.orderNumber}
                      </td>
                      <td className={`py-3 whitespace-nowrap ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className={`py-3 whitespace-nowrap ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                        {order.customerName}
                      </td>
                      <td className="py-3">
                        <div className="space-y-0.5">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item, idx) => (
                              <div key={idx} className={`text-xs leading-snug ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                                <span className="font-medium">{item.product?.name}</span>
                                {item.option?.optionName && (
                                  <span className="text-muted-foreground"> / {item.option.optionName}</span>
                                )}
                                <span className="text-muted-foreground"> × {item.quantity}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className={`py-3 whitespace-nowrap ${isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                        {formatCurrency(order.totalPrice)}
                      </td>
                      <td className="py-3">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {(!data || data.orders.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      주문 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                총 {data.total}건 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, data.total)}건
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 주문 상세 다이얼로그 ── */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>주문 상세 - {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">고객명</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">연락처</p>
                  <p className="font-medium">{selectedOrder.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">주소</p>
                  <p className="font-medium">
                    {[selectedOrder.zipNo, selectedOrder.addrBase, selectedOrder.addrDetail].filter(Boolean).join(' ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">입금자명</p>
                  <p className="font-medium">{selectedOrder.depositName || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">총 금액</p>
                  <p className="font-medium">{formatCurrency(selectedOrder.totalPrice)}</p>
                </div>
                {selectedOrder.memo && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">메모</p>
                    <p className="font-medium">{selectedOrder.memo}</p>
                  </div>
                )}
              </div>

              {/* 구매항목 목록 */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/60 border-b">
                    <span className="text-sm font-semibold">구매항목 ({selectedOrder.items.length}종)</span>
                  </div>
                  <div className="divide-y">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 px-3 py-2.5">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-medium">{item.product?.name}</p>
                          {item.option?.optionName && (
                            <p className="text-xs text-muted-foreground">옵션: {item.option.optionName}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(Math.round(item.price / item.quantity))} × {item.quantity}개
                          </p>
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-3 py-2 bg-muted/30">
                      <span className="text-sm text-muted-foreground">합계</span>
                      <span className="font-bold text-sm">{formatCurrency(selectedOrder.totalPrice)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 가상계좌 정보 */}
              {selectedOrder.payment?.vbankNum && (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-blue-800">가상계좌 입금 안내</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">은행</span>
                      <p className="font-medium">{selectedOrder.payment.vbankName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">예금주</span>
                      <p className="font-medium">{selectedOrder.payment.vbankHolder}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">계좌번호</span>
                      <p className="font-mono font-bold text-base tracking-wider">{selectedOrder.payment.vbankNum}</p>
                    </div>
                    {selectedOrder.payment.vbankExpiry && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">입금 기한</span>
                        <p className="font-medium text-orange-600">
                          {new Date(selectedOrder.payment.vbankExpiry).toLocaleDateString('ko-KR')} 까지
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedOrder.payment.status === 'paid' && (
                    <p className="text-xs text-green-700 font-medium mt-1">✓ 입금 확인 완료</p>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">상태 변경</p>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(val) => handleStatusChange(selectedOrder.id, val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusFilters.filter((f) => f.value !== 'all').map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => handleStatusChange(selectedOrder.id, 'shipping')}
                  disabled={selectedOrder.status === 'shipping' || selectedOrder.status === 'completed'}
                >
                  배송 시작
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleStatusChange(selectedOrder.id, 'canceled')}
                  disabled={selectedOrder.status === 'canceled'}
                >
                  취소 처리
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
