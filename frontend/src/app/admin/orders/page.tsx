'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RefreshCw, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrderRow {
  id: number; orderNumber: string; customerName: string; phone: string;
  totalPrice: number; status: string; createdAt: string; itemCount: number;
  user: { email: string; name: string }; project: string;
  payment: { status: string; amount: number; paidAt: string | null } | null;
}
interface Paginated { data: OrderRow[]; total: number; page: number; totalPages: number; }

const ORDER_STATUSES  = ['', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const PAY_STATUSES    = ['', 'pending', 'matched', 'paid', 'failed'];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: '대기',     cls: 'bg-yellow-100 text-yellow-700' },
  paid:      { label: '결제완료', cls: 'bg-green-100 text-green-700'  },
  shipped:   { label: '배송중',   cls: 'bg-blue-100 text-blue-700'   },
  delivered: { label: '배송완료', cls: 'bg-gray-100 text-gray-700'   },
  cancelled: { label: '취소',     cls: 'bg-red-100 text-red-700'     },
  matched:   { label: '매칭완료', cls: 'bg-teal-100 text-teal-700'   },
  failed:    { label: '실패',     cls: 'bg-red-100 text-red-700'     },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.cls}`}>{m.label}</span>;
}

interface Filters {
  orderNumber: string; customerName: string; phone: string;
  sellerEmail: string; projectName: string;
  status: string; paymentStatus: string;
  dateFrom: string; dateTo: string;
}

const EMPTY: Filters = {
  orderNumber: '', customerName: '', phone: '',
  sellerEmail: '', projectName: '',
  status: '', paymentStatus: '',
  dateFrom: '', dateTo: '',
};

export default function AdminOrdersPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const load = useCallback((p: number, f: Filters) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), limit: '30' });
    Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, v); });
    apiFetch<Paginated>(`/admin/orders?${q}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, applied); }, [page, applied, load]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setApplied(filters); };
  const handleReset  = () => { setFilters(EMPTY); setPage(1); setApplied(EMPTY); };

  const hasFilter = Object.values(applied).some(Boolean);

  const set = (k: keyof Filters, v: string) => setFilters((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">주문 조회</h1>
          <p className="text-sm text-gray-500">전체 {data?.total ?? '…'}건</p>
        </div>
        {hasFilter && (
          <button onClick={handleReset} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />필터 초기화
          </button>
        )}
      </div>

      {/* 검색 필터 */}
      <form onSubmit={handleSearch} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterInput label="주문번호"  value={filters.orderNumber}  onChange={(v) => set('orderNumber', v)} />
          <FilterInput label="고객명"    value={filters.customerName} onChange={(v) => set('customerName', v)} />
          <FilterInput label="전화번호"  value={filters.phone}        onChange={(v) => set('phone', v)} />
          <FilterInput label="셀러 이메일" value={filters.sellerEmail} onChange={(v) => set('sellerEmail', v)} />
          <FilterInput label="프로젝트명" value={filters.projectName} onChange={(v) => set('projectName', v)} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">주문상태</label>
            <select value={filters.status} onChange={(e) => set('status', e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none bg-white">
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s === '' ? '전체' : STATUS_META[s]?.label ?? s}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">결제상태</label>
            <select value={filters.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none bg-white">
              {PAY_STATUSES.map((s) => <option key={s} value={s}>{s === '' ? '전체' : STATUS_META[s]?.label ?? s}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">주문일 시작</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none bg-white" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">주문일 종료</label>
            <input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none bg-white" />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">
            <Search className="w-3.5 h-3.5" />검색
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['주문번호', '고객명', '전화번호', '프로젝트', '셀러', '금액', '주문상태', '결제상태', '주문일시'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((o) => (
                <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{o.orderNumber}</td>
                  <td className="px-3 py-2.5 font-medium">{o.customerName}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{o.phone}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[100px] truncate">{o.project}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">{o.user?.email}</td>
                  <td className="px-3 py-2.5 font-semibold">{o.totalPrice.toLocaleString()}원</td>
                  <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2.5">
                    {o.payment ? <StatusBadge status={o.payment.status} /> : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{new Date(o.createdAt).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination data={data} page={page} setPage={setPage} />
        </div>
      )}
    </div>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label}
        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white" />
    </div>
  );
}

function Pagination({ data, page, setPage }: { data: Paginated | null; page: number; setPage: (p: number) => void }) {
  if (!data || data.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
      <p className="text-xs text-gray-500">총 {data.total}건</p>
      <div className="flex gap-1">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}
          className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-white">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="px-3 py-1 text-xs font-medium">{page} / {data.totalPages}</span>
        <button disabled={page === data.totalPages} onClick={() => setPage(page + 1)}
          className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-white">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
