'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface PaymentRow {
  id: number; amount: number; status: string; paidAt: string | null;
  depositorName: string | null; impUid: string | null;
  vbankNum: string | null; vbankName: string | null; createdAt: string;
  order: { orderNumber: string; customerName: string; user: { email: string }; project: { name: string } | null };
}
interface Paginated { data: PaymentRow[]; total: number; page: number; totalPages: number; }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '결제완료', cls: 'bg-green-100 text-green-700' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700' },
  refunded: { label: '환불', cls: 'bg-purple-100 text-purple-700' },
};

const STATUSES = ['', 'pending', 'paid', 'failed', 'refunded'];

export default function AdminPaymentsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const load = useCallback((p: number, s: string) => {
    setLoading(true);
    apiFetch<Paginated>(`/admin/payments?page=${p}&limit=30&status=${s}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, status); }, [page, status, load]);

  const totalPaid = data?.data.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">결제 조회</h1>
          <p className="text-sm text-gray-500">전체 {data?.total ?? '…'}건</p>
        </div>
        <div className="flex gap-2 items-center">
          {status === 'paid' && (
            <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
              이 페이지 합계: {totalPaid.toLocaleString()}원
            </span>
          )}
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? '전체 상태' : STATUS_META[s]?.label ?? s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['주문번호', '고객명', '셀러', '프로젝트', '금액', '상태', '입금자', '가상계좌', '결제일', '생성일'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((p) => {
                const sm = STATUS_META[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{p.order.orderNumber}</td>
                    <td className="px-3 py-2.5 font-medium">{p.order.customerName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">{p.order.user.email}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[100px] truncate">{p.order.project?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-semibold">{p.amount.toLocaleString()}원</td>
                    <td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sm.cls}`}>{sm.label}</span></td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.depositorName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      {p.vbankNum ? `${p.vbankName} ${p.vbankNum}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{p.paidAt ? new Date(p.paidAt).toLocaleDateString('ko-KR') : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                );
              })}
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
