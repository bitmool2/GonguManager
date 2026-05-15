'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, ChevronRight, Building2, Truck, Package, CreditCard } from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const { refreshProjects } = useProject();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    /* 기본 정보 */
    name: '',
    description: '',
    status: 'active',
    slug: '',
    startDate: '',
    endDate: '',
    /* 결제 방식 */
    paymentMethod: 'personal' as 'personal' | 'vbank' | 'both',
    impKey: '',
    /* 계좌 정보 */
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    /* 배송 정책 */
    shippingDays: '' as number | '',
    exchangeDays: '' as number | '',
  });

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('프로젝트 이름은 필수입니다.'); return; }

    /* 개인계좌 / 모두 사용 선택 시 계좌정보 필수 */
    if (form.paymentMethod === 'personal' || form.paymentMethod === 'both') {
      if (!form.bankName.trim() || !form.bankAccount.trim() || !form.bankHolder.trim()) {
        setError('개인계좌 사용 시 은행명, 계좌번호, 예금주를 모두 입력해주세요.');
        return;
      }
    }

    setError('');
    setSaving(true);
    try {
      const created = await apiFetch<{ id: number }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim() || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          shippingDays: form.shippingDays === '' ? undefined : Number(form.shippingDays),
          exchangeDays: form.exchangeDays === '' ? undefined : Number(form.exchangeDays),
        }),
      });
      await refreshProjects();
      router.push(`/projects/${created.id}?tab=products`);
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/projects')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">새 프로젝트 만들기</h1>
          <p className="text-sm text-muted-foreground">기본 정보와 계좌·배송 정책을 설정하세요. 상품·FAQ는 생성 후 추가할 수 있습니다.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>
      )}

      {/* ─── 기본 정보 ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />프로젝트 기본 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>프로젝트 이름 <span className="text-red-500">*</span></Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="예: 5월 핸드메이드 비누 공구"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>설명</Label>
            <Input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="간단한 설명을 입력하세요"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">준비중</SelectItem>
                  <SelectItem value="active">진행중</SelectItem>
                  <SelectItem value="closed">종료</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>주문폼 Slug (URL)</Label>
              <Input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="may-soap-gongu"
              />
              {form.slug && (
                <p className="text-xs text-muted-foreground">/order/{form.slug}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>시작일</Label>
              <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>종료일</Label>
              <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 계좌 정보 ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />입금 방식
            <span className="text-red-500 ml-0.5">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 결제 방식 선택 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'personal', label: '개인계좌', desc: '직접 계좌 안내' },
              { value: 'vbank',    label: '가상계좌', desc: '포트원 자동 발급' },
              { value: 'both',     label: '모두 사용', desc: '두 방식 동시' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('paymentMethod', opt.value)}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  form.paymentMethod === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className={`text-sm font-semibold ${form.paymentMethod === opt.value ? 'text-primary' : ''}`}>{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* 개인계좌 입력 (personal / both) */}
          {(form.paymentMethod === 'personal' || form.paymentMethod === 'both') && (
            <div className="space-y-3 pt-1">
              <p className="text-sm font-medium text-muted-foreground">개인계좌 정보</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>은행명 <span className="text-red-500">*</span></Label>
                  <Input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>계좌번호 <span className="text-red-500">*</span></Label>
                  <Input value={form.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>예금주 <span className="text-red-500">*</span></Label>
                  <Input value={form.bankHolder} onChange={(e) => set('bankHolder', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* 가상계좌 안내 (vbank / both) */}
          {(form.paymentMethod === 'vbank' || form.paymentMethod === 'both') && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <p className="text-sm font-medium text-blue-800 flex items-center gap-1">
                <CreditCard className="w-4 h-4" />가상계좌 (포트원)
              </p>
              <div className="space-y-1.5">
                <Label className="text-blue-800 text-xs">가맹점 식별코드 (IMP Key) <span className="text-red-500">*</span></Label>
                <Input
                  value={form.impKey}
                  onChange={(e) => set('impKey', e.target.value)}
                  placeholder="imp_xxxxxxxxxx"
                  className="bg-white font-mono text-sm"
                />
                <p className="text-xs text-blue-600">
                  포트원 관리자 콘솔 → 상점·계정 관리 → 내 식별코드·API Keys 에서 확인하세요.
                </p>
                <a
                  href="https://admin.portone.io"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 font-medium hover:underline"
                >
                  포트원 관리자 콘솔 바로가기
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 배송 정책 ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="w-4 h-4 text-green-500" />배송 정책
            <span className="text-xs font-normal text-muted-foreground ml-1">(선택)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>배송 예정일 (영업일)</Label>
              <Input
                type="number"
                value={form.shippingDays}
                onChange={(e) => set('shippingDays', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="예: 3"
              />
            </div>
            <div className="space-y-2">
              <Label>교환 가능일</Label>
              <Input
                type="number"
                value={form.exchangeDays}
                onChange={(e) => set('exchangeDays', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="예: 7"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 안내 ─── */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
        <span>저장 후 프로젝트 설정 페이지로 이동합니다. <strong>상품 등록</strong>과 <strong>FAQ</strong>는 그곳에서 추가할 수 있습니다.</span>
      </div>

      {/* ─── 버튼 ─── */}
      <div className="flex gap-3 pb-8">
        <Button variant="outline" onClick={() => router.push('/projects')} className="w-32">
          취소
        </Button>
        <Button onClick={handleCreate} disabled={saving || !form.name.trim()} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '상세설정 시작'}
        </Button>
      </div>
    </div>
  );
}
