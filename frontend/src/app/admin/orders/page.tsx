'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrderRow {
  id: number; orderNumber: string; customerName: string; phone: string;
  totalPrice: number; status: string; createdAt: string; itemCount: number;
  user: { email: string; name: string }; project: string;
  payment: { status: string; amount: number; paidAt: string | null } | null;
}
interface Paginated { data: OrderRow[]; total: number; page: number; totalPages: number; }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '결제완료', cls: 'bg-green-100 text-green-700' },
  shipped: { label: '배송중', cls: 'bg-blue-100 text-blue-700' },
  delivered: { label: '배송완료', cls: 'bg-gray-100 text-gray-700' },
  cancelled: { label: '취소', cls: 'bg-red-100 text-red-700' },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.cls}`}>{m.label}</span>;
}

const STATUSES = ['', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrdersPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback((p: number, q: string, s: string) => {
    setLoading(true);
    apiFetch<Paginated>(`/admin/orders?page=${p}&limit=30&search=${encodeURIComponent(q)}&status=${s}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, query, status); }, [page, query, status, load]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setQuery(search); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">주문 조회</h1>
          <p className="text-sm text-gray-500">전체 {data?.total ?? '…'}건</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? '전체 상태' : STATUS_META[s]?.label ?? s}</option>
            ))}
          </select>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="주문번호/이름/전화번호"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <button type="submit" className="p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['주문번호', '고객명', '전화번호', '프로젝트', '셀러', '금액', '상태', '결제', '주문일시'].map((h) => (
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
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">총 {data.total}건</p>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-white"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span className="px-3 py-1 text-xs font-medium">{page} / {data.totalPages}</span>
                <button disabled={page === data.totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-white"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
