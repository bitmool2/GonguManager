'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RefreshCw, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProjectRow {
  id: number; name: string; status: string; slug: string | null;
  startDate: string | null; endDate: string | null; createdAt: string;
  user: { email: string; name: string }; orderCount: number; productCount: number;
}
interface Paginated { data: ProjectRow[]; total: number; page: number; totalPages: number; }

const STATUSES = ['', 'active', 'closed', 'draft'];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: '진행중',     cls: 'bg-green-100 text-green-700'  },
  closed: { label: '마감',       cls: 'bg-gray-100 text-gray-600'    },
  draft:  { label: '임시저장',   cls: 'bg-yellow-100 text-yellow-700'},
};

interface Filters { name: string; sellerEmail: string; status: string; dateFrom: string; dateTo: string; }
const EMPTY: Filters = { name: '', sellerEmail: '', status: '', dateFrom: '', dateTo: '' };

export default function AdminProjectsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const load = useCallback((p: number, f: Filters) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p), limit: '30' });
    Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, v); });
    apiFetch<Paginated>(`/admin/projects?${q}`)
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
          <h1 className="text-xl font-bold">프로젝트 조회</h1>
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
          <FilterInput label="프로젝트명"   value={filters.name}        onChange={(v) => set('name', v)} />
          <FilterInput label="셀러 이메일"  value={filters.sellerEmail} onChange={(v) => set('sellerEmail', v)} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">상태</label>
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
                {['ID', '프로젝트명', '상태', '셀러', '시작일', '종료일', '주문/상품', '생성일'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((p) => {
                const sm = STATUS_META[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{p.id}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{p.name}</p>
                      {p.slug && <p className="text-[10px] text-gray-400 font-mono">{p.slug}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sm.cls}`}>{sm.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.user?.email}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.startDate ? new Date(p.startDate).toLocaleDateString('ko-KR') : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.endDate   ? new Date(p.endDate).toLocaleDateString('ko-KR')   : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-center text-gray-600">{p.orderCount} / {p.productCount}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('ko-KR')}</td>
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
