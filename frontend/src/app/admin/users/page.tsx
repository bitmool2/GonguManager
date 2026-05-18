'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { PLAN_CONFIG, PlanType } from '@/lib/plans';
import { RefreshCw, Search, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserRow {
  id: number; email: string; name: string; role: string; createdAt: string;
  projectCount: number; orderCount: number;
  subscription: {
    planType: string; status: string; startDate: string; endDate: string | null;
    passTotal: number | null; passUsed: number; passExpiry: string | null;
    ordersUsed: number; impUid: string | null;
  } | null;
}

interface Paginated { data: UserRow[]; total: number; page: number; totalPages: number; }

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700 border-gray-200',
  basic: 'bg-blue-100 text-blue-700 border-blue-200',
  pro: 'bg-purple-100 text-purple-700 border-purple-200',
  biz: 'bg-amber-100 text-amber-700 border-amber-200',
  pass_1: 'bg-green-100 text-green-700 border-green-200',
  pass_3: 'bg-green-100 text-green-700 border-green-200',
  pass_10: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function PlanBadge({ planType }: { planType: string }) {
  const cfg = PLAN_CONFIG[planType as PlanType];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${PLAN_COLORS[planType] ?? 'bg-gray-100 text-gray-600'}`}>
      {planType !== 'free' && <Crown className="w-2.5 h-2.5" />}
      {cfg?.name ?? planType}
    </span>
  );
}

export default function AdminUsersPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    apiFetch<Paginated>(`/admin/users?page=${p}&limit=20&search=${encodeURIComponent(q)}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, query); }, [page, query, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); setPage(1); setQuery(search);
  };

  const handleRoleToggle = async (user: UserRow) => {
    const newRole = user.role === 'admin' ? 'seller' : 'admin';
    if (!confirm(`${user.email}의 역할을 "${newRole}"로 변경하시겠습니까?`)) return;
    try {
      await apiFetch(`/admin/users/${user.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
      load(page, query);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">사용자 관리</h1>
          <p className="text-sm text-gray-500">전체 {data?.total ?? '…'}명</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="이메일/이름 검색"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <button type="submit" className="p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', '이메일 / 이름', '플랜', '플랜결제 상태', '구독 시작', '만료일', '다음 결제일', '역할'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((u) => {
                const sub = u.subscription;
                const nextBilling = sub?.endDate ? new Date(sub.endDate) : null;
                return (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.email}</p>
                      <p className="text-xs text-gray-400">{u.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      {sub ? <PlanBadge planType={sub.planType} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          sub.planType === 'free'
                            ? 'bg-gray-50 text-gray-500 border-gray-200'
                            : sub.status === 'active' && sub.impUid
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : sub.status === 'active'
                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {sub.planType === 'free'
                            ? '무료'
                            : sub.status === 'active' && sub.impUid
                            ? '결제완료'
                            : sub.status === 'active'
                            ? '관리자적용'
                            : sub.status === 'expired'
                            ? '만료'
                            : sub.status}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {sub ? new Date(sub.startDate).toLocaleDateString('ko-KR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {sub?.endDate ? new Date(sub.endDate).toLocaleDateString('ko-KR') : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {nextBilling ? (
                        <span className={nextBilling < new Date() ? 'text-red-500' : 'text-gray-600'}>
                          {nextBilling.toLocaleDateString('ko-KR')}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleRoleToggle(u)}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition-colors ${
                          u.role === 'admin'
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {u.role}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 페이지네이션 */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">{data.total}명 중 {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)}명</p>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 py-1 text-xs font-medium">{page} / {data.totalPages}</span>
                <button disabled={page === data.totalPages} onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
