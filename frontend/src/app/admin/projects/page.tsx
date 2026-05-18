'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProjectRow {
  id: number; name: string; status: string; slug: string | null;
  startDate: string | null; endDate: string | null; createdAt: string;
  user: { email: string; name: string }; orderCount: number; productCount: number;
}
interface Paginated { data: ProjectRow[]; total: number; page: number; totalPages: number; }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: '진행중', cls: 'bg-green-100 text-green-700' },
  closed: { label: '마감', cls: 'bg-gray-100 text-gray-600' },
  draft: { label: '임시저장', cls: 'bg-yellow-100 text-yellow-700' },
};

export default function AdminProjectsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    apiFetch<Paginated>(`/admin/projects?page=${p}&limit=30&search=${encodeURIComponent(q)}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, query); }, [page, query, load]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setQuery(search); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">프로젝트 조회</h1>
          <p className="text-sm text-gray-500">전체 {data?.total ?? '…'}건</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="프로젝트명 검색"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-gray-300" />
          <button type="submit" className="p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700"><Search className="w-4 h-4" /></button>
        </form>
      </div>

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
                    <td className="px-3 py-2.5 text-xs text-gray-500">{p.endDate ? new Date(p.endDate).toLocaleDateString('ko-KR') : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-center text-gray-600">{p.orderCount} / {p.productCount}</td>
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
