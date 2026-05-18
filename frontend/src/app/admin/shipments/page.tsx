'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RefreshCw, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ShipmentRow {
  id: number; status: string; courier: string | null; trackingNumber: string | null;
  shippedAt: string | null; createdAt: string;
  order: { orderNumber: string; customerName: string; addrBase: string | null; addrDetail: string | null; user: { email: string } };
}
interface Paginated { data: ShipmentRow[]; total: number; page: number; totalPages: number; }

const STATUSES = ['', 'pending', 'shipped', 'delivered', 'returned'];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: '준비중',   cls: 'bg-yellow-100 text-yellow-700' },
  shipped:   { label: '발송완료', cls: 'bg-blue-100 text-blue-700'    },
  delivered: { label: '배송완료', cls: 'bg-green-100 text-green-700'  },
  returned:  { label: '반품',     cls: 'bg-red-100 text-red-700'      },
};

interface Filters {
  orderNumber: string; customerName: string; sellerEmail: string;
  status: string; courier: string; trackingNumber: string;
  dateFrom: string; dateTo: string;
}
const EMPTY: Filters = {
  orderNumber: '', customerName: '', sellerEmail: '',
  status: '', courier: '', trackingNumber: '',
  dateFrom: '', dateTo: '',
};

export default function AdminShipmentsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const load = useCallback((p: number, f: Filters) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), limit: '30' });
    Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, v); });
    apiFetch<Paginated>(`/admin/shipments?${q}`)
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
          <h1 className="text-xl font-bold">배송 조회</h1>
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
          <FilterInput label="주문번호"    value={filters.orderNumber}    onChange={(v) => set('orderNumber', v)} />
          <FilterInput label="고객명"      value={filters.customerName}   onChange={(v) => set('customerName', v)} />
          <FilterInput label="셀러 이메일" value={filters.sellerEmail}    onChange={(v) => set('sellerEmail', v)} />
          <FilterInput label="택배사"      value={filters.courier}        onChange={(v) => set('courier', v)} />
          <FilterInput label="운송장번호"  value={filters.trackingNumber} onChange={(v) => set('trackingNumber', v)} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">배송상태</label>
            <select value={filters.status} onChange={(e) => set('status', e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none bg-white">
              {STATUSES.map((s) => <option key={s} value={s}>{s === '' ? '전체' : STATUS_META[s]?.label ?? s}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">생성일 시작</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none bg-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">생성일 종료</label>
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
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['주문번호', '고객명', '주소', '셀러', '택배사', '운송장번호', '상태', '발송일', '생성일'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((s) => {
                const sm = STATUS_META[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' };
                const addr = [s.order.addrBase, s.order.addrDetail].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{s.order.orderNumber}</td>
                    <td className="px-3 py-2.5 font-medium">{s.order.customerName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[160px] truncate" title={addr}>{addr}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">{s.order.user.email}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{s.courier ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{s.trackingNumber ?? '—'}</td>
                    <td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sm.cls}`}>{sm.label}</span></td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{s.shippedAt ? new Date(s.shippedAt).toLocaleDateString('ko-KR') : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                );
              })}
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
          className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-white"><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span className="px-3 py-1 text-xs font-medium">{page} / {data.totalPages}</span>
        <button disabled={page === data.totalPages} onClick={() => setPage(page + 1)}
          className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-white"><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
