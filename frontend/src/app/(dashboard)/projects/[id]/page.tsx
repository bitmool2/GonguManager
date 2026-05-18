'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, getEmailPrefix } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
  X,
  Check,
  CreditCard,
  Bot,
  Upload,
  Send,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';

/* ─── 타입 ─────────────────────────────────────────────── */
interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  shippingDays?: number;
  exchangeDays?: number;
  paymentMethod?: string;
  impKey?: string;
}

interface ProductOption {
  id: number;
  optionName: string;
  stock: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  status: string;
  options: ProductOption[];
}

// 옵션 그룹 (UI 전용): 그룹명 + 값 목록
interface OptionGroup {
  name: string;       // 예: "색상"
  values: string[];   // 예: ["빨강", "파랑"]
}

// 조합 생성: Cartesian product
function buildCombinations(groups: OptionGroup[]): string[] {
  if (groups.length === 0) return [];
  const filled = groups.filter((g) => g.name && g.values.some((v) => v.trim()));
  if (filled.length === 0) return [];
  return filled.reduce<string[]>((acc, group) => {
    const vals = group.values.filter((v) => v.trim());
    if (acc.length === 0) return vals;
    return acc.flatMap((prev) => vals.map((val) => `${prev}-${val}`));
  }, []);
}

interface Faq {
  id: number;
  question: string;
  answer: string;
}

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  active: { label: '진행중', variant: 'success' },
  draft: { label: '준비중', variant: 'warning' },
  closed: { label: '종료', variant: 'secondary' },
};

/* ─── 컴포넌트 ────────────────────────────────────────── */
function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'info';
  const { refreshProjects } = useProject();
  const emailPrefix = getEmailPrefix();

  /* 프로젝트 기본 정보 */
  const [project, setProject] = useState<Project | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active',
    slug: '',
    startDate: '',
    endDate: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    shippingDays: '' as number | '',
    exchangeDays: '' as number | '',
    paymentMethod: 'personal',
    impKey: '',
  });
  const [savingProject, setSavingProject] = useState(false);

  /* 상품 */
  const [products, setProducts] = useState<Product[]>([]);
  // 신규 상품 등록 폼
  const [newProduct, setNewProduct] = useState({ name: '', price: 0, stock: 0 });
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({});
  // 상품 수정
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // 옵션 인라인 편집
  const [editingOption, setEditingOption] = useState<ProductOption | null>(null);
  const [editingOptionProductId, setEditingOptionProductId] = useState<number | null>(null);
  // 기존 상품에 옵션 추가
  const [addingOptionFor, setAddingOptionFor] = useState<number | null>(null);
  const [addOptionGroups, setAddOptionGroups] = useState<OptionGroup[]>([]);
  const [addVariantStocks, setAddVariantStocks] = useState<Record<string, number>>({});

  /* FAQ */
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  /* 상품 AI 상세정보 */
  const [detailProductId,   setDetailProductId]   = useState<number | null>(null);
  const [detailText,        setDetailText]         = useState('');
  const [detailFileName,    setDetailFileName]     = useState<string | null>(null);
  const [detailSaving,      setDetailSaving]       = useState(false);
  const [detailDeleting,    setDetailDeleting]     = useState(false);
  const detailFileRef = useRef<HTMLInputElement>(null);

  const openDetailDialog = (product: Product) => {
    setDetailProductId(product.id);
    setDetailText((product as any).detail?.description ?? '');
    setDetailFileName((product as any).detail?.fileName ?? null);
    if (detailFileRef.current) detailFileRef.current.value = '';
  };

  const handleDetailDelete = async (productId: number) => {
    if (!confirm('등록된 AI 상세정보를 삭제하시겠습니까?')) return;
    setDetailDeleting(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3021';
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/products/${productId}/detail-file`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadProducts();
      setDetailProductId(null);
    } catch (err: any) {
      alert(`삭제 오류: ${err.message}`);
    } finally {
      setDetailDeleting(false);
    }
  };

  /* AI 상담 테스트 */
  const [aiMessages,  setAiMessages]  = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [aiInput,     setAiInput]     = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiSessionId, setAiSessionId] = useState<number | null>(null);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState('');

  /* ── 데이터 로드 ── */
  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [proj, prods, faqList] = await Promise.all([
        apiFetch<Project>(`/projects/${id}`),
        apiFetch<Product[]>(`/products?projectId=${id}`),
        apiFetch<Faq[]>(`/faqs?projectId=${id}`),
      ]);
      setProject(proj);
      setForm({
        name: proj.name,
        description: proj.description ?? '',
        status: proj.status,
        slug: proj.slug ?? '',
        startDate: proj.startDate ? proj.startDate.slice(0, 10) : '',
        endDate: proj.endDate ? proj.endDate.slice(0, 10) : '',
        bankName: proj.bankName ?? '',
        bankAccount: proj.bankAccount ?? '',
        bankHolder: proj.bankHolder ?? '',
        shippingDays: proj.shippingDays ?? '',
        exchangeDays: proj.exchangeDays ?? '',
        paymentMethod: proj.paymentMethod ?? 'personal',
        impKey: proj.impKey ?? '',
      });
      setProducts(prods);
      setFaqs(faqList);
    } catch (e: any) {
      setLoadError(e.message || '데이터를 불러오지 못했습니다.');
    }
  }, [id]);

  const loadProducts = useCallback(async () => {
    const prods = await apiFetch<Product[]>(`/products?projectId=${id}`);
    setProducts(prods);
  }, [id]);

  const handleAiSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading || !project?.slug) return;
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', content: text }]);
    setAiLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3021';
      const visitorId = `admin_${id}`;
      const res = await fetch(`${API_BASE}/chat/${project.slug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ visitorId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '오류');
      setAiSessionId(data.sessionId);
      setAiMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setAiMessages((prev) => [...prev, { role: 'assistant', content: `오류: ${err.message}` }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [aiInput, aiLoading, project, id]);

  useEffect(() => { load(); }, [load]);

  /* ── 프로젝트 저장 ── */
  const handleSaveProject = async () => {
    setSavingProject(true);
    try {
      await apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(form) });
      await refreshProjects();
      await load();
    } finally {
      setSavingProject(false);
    }
  };

  /* ── 상품 추가 ── */
  const handleAddProduct = async () => {
    if (!newProduct.name) return;
    const combos = buildCombinations(optionGroups);
    const options = combos.length > 0
      ? combos.map((c) => ({ optionName: c, stock: variantStocks[c] ?? 0 }))
      : [];
    const p = await apiFetch<Product>('/products', {
      method: 'POST',
      body: JSON.stringify({ ...newProduct, projectId: id, options }),
    });
    setProducts([p, ...products]);
    setNewProduct({ name: '', price: 0, stock: 0 });
    setOptionGroups([]);
    setVariantStocks({});
  };

  /* ── 상품 수정 저장 ── */
  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    const updated = await apiFetch<Product>(`/products/${editingProduct.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editingProduct.name, price: editingProduct.price, stock: editingProduct.stock }),
    });
    setProducts(products.map((p) => (p.id === updated.id ? { ...updated, options: editingProduct.options } : p)));
    setEditingProduct(null);
  };

  /* ── 상품 삭제 ── */
  const handleDeleteProduct = async (pid: number) => {
    if (!confirm('상품을 삭제하시겠습니까?')) return;
    await apiFetch(`/products/${pid}`, { method: 'DELETE' });
    setProducts(products.filter((p) => p.id !== pid));
  };

  /* ── 옵션 수정 ── */
  const handleUpdateOption = async (productId: number) => {
    if (!editingOption) return;
    const updated = await apiFetch<ProductOption>(
      `/products/${productId}/options/${editingOption.id}`,
      { method: 'PUT', body: JSON.stringify({ optionName: editingOption.optionName, stock: editingOption.stock }) },
    );
    setProducts(products.map((p) =>
      p.id === productId
        ? { ...p, options: p.options.map((o) => (o.id === updated.id ? updated : o)) }
        : p,
    ));
    setEditingOption(null);
    setEditingOptionProductId(null);
  };

  /* ── 옵션 삭제 ── */
  const handleDeleteOption = async (productId: number, optionId: number) => {
    await apiFetch(`/products/${productId}/options/${optionId}`, { method: 'DELETE' });
    setProducts(products.map((p) =>
      p.id === productId ? { ...p, options: p.options.filter((o) => o.id !== optionId) } : p,
    ));
  };

  /* ── 기존 상품에 옵션(조합) 추가 ── */
  const handleAddOptionsToProduct = async (productId: number) => {
    const combos = buildCombinations(addOptionGroups);
    if (combos.length === 0) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const available = 3 - product.options.length;
    const toAdd = combos.slice(0, available);
    const added: ProductOption[] = [];
    for (const combo of toAdd) {
      const opt = await apiFetch<ProductOption>(`/products/${productId}/options`, {
        method: 'POST',
        body: JSON.stringify({ optionName: combo, stock: addVariantStocks[combo] ?? 0 }),
      });
      added.push(opt);
    }
    setProducts(products.map((p) =>
      p.id === productId ? { ...p, options: [...p.options, ...added] } : p,
    ));
    setAddingOptionFor(null);
    setAddOptionGroups([]);
    setAddVariantStocks({});
  };

  /* ── FAQ 추가 ── */
  const handleAddFaq = async () => {
    if (!newFaq.question || !newFaq.answer) return;
    const f = await apiFetch<Faq>('/faqs', {
      method: 'POST',
      body: JSON.stringify({ ...newFaq, projectId: Number(id) }),
    });
    setFaqs([...faqs, f]);
    setNewFaq({ question: '', answer: '' });
  };

  /* ── FAQ 수정 저장 ── */
  const handleUpdateFaq = async () => {
    if (!editingFaq) return;
    const updated = await apiFetch<Faq>(`/faqs/${editingFaq.id}`, {
      method: 'PUT',
      body: JSON.stringify({ question: editingFaq.question, answer: editingFaq.answer }),
    });
    setFaqs(faqs.map((f) => (f.id === updated.id ? updated : f)));
    setEditingFaq(null);
  };

  /* ── FAQ 삭제 ── */
  const handleDeleteFaq = async (fid: number) => {
    await apiFetch(`/faqs/${fid}`, { method: 'DELETE' });
    setFaqs(faqs.filter((f) => f.id !== fid));
  };

  /* ── 프로젝트 단위 계좌/배송 저장 ── */
  const handleSaveSettings = async () => {
    /* 개인계좌 / 모두 사용 선택 시 계좌정보 필수 */
    if (form.paymentMethod === 'personal' || form.paymentMethod === 'both') {
      if (!form.bankName.trim() || !form.bankAccount.trim() || !form.bankHolder.trim()) {
        setSettingsMsg({ type: 'err', text: '개인계좌 사용 시 은행명, 계좌번호, 예금주를 모두 입력해주세요.' });
        return;
      }
    }

    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      await apiFetch(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          bankName: form.bankName,
          bankAccount: form.bankAccount,
          bankHolder: form.bankHolder,
          shippingDays: form.shippingDays === '' ? null : Number(form.shippingDays),
          exchangeDays: form.exchangeDays === '' ? null : Number(form.exchangeDays),
          paymentMethod: form.paymentMethod,
          impKey: form.impKey || null,
        }),
      });
      setSettingsMsg({ type: 'ok', text: '저장되었습니다.' });
      setTimeout(() => setSettingsMsg(null), 3000);
    } catch (e: any) {
      setSettingsMsg({ type: 'err', text: e.message || '저장에 실패했습니다.' });
    } finally {
      setSavingSettings(false);
    }
  };

  // 신규 상품 옵션 총 재고 합계
  const newProductTotalStock = Object.values(variantStocks).reduce((sum, v) => sum + (v || 0), 0);
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n) + '원';

  if (loadError) return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
        <ArrowLeft className="w-4 h-4 mr-2" />목록으로
      </Button>
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">오류: {loadError}</div>
    </div>
  );
  if (!project) return <div className="p-6 text-muted-foreground">로딩 중...</div>;

  const s = statusMap[project.status] || { label: project.status, variant: 'secondary' as const };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/projects')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <Badge variant={s.variant}>{s.label}</Badge>
          </div>
          {project.slug && (() => {
            // slug가 이미 emailPrefix_xxx 형태인지 확인 후 아니면 prefix 붙임
            const fullSlug =
              emailPrefix && !project.slug.startsWith(`${emailPrefix}_`)
                ? `${emailPrefix}_${project.slug}`
                : project.slug;
            return (
              <a
                href={`/order/${fullSlug}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                /order/{fullSlug}
              </a>
            );
          })()}
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="info">기본 정보</TabsTrigger>
          <TabsTrigger value="products">상품 관리</TabsTrigger>
          <TabsTrigger value="bank">계좌 설정</TabsTrigger>
          <TabsTrigger value="shipping">배송 정책</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="ai">AI 상담</TabsTrigger>
        </TabsList>

        {/* ── 기본 정보 ── */}
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">프로젝트 기본 정보</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>프로젝트 이름 *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>설명</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="간단한 설명" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>상태</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">준비중</SelectItem>
                      <SelectItem value="active">진행중</SelectItem>
                      <SelectItem value="closed">종료</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>주문폼 URL</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="my-gongu-2026"
                  />
                  {form.slug && (
                    <p className="text-xs text-muted-foreground">
                      /order/{emailPrefix ? `${emailPrefix}_${form.slug}` : form.slug}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시작일</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>종료일</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleSaveProject} disabled={savingProject || !form.name}>
                <Save className="w-4 h-4 mr-2" />
                {savingProject ? '저장 중...' : '저장'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 상품 관리 ── */}
        <TabsContent value="products" className="mt-4 space-y-4">

          {/* 상품 추가 폼 */}
          <Card>
            <CardHeader><CardTitle className="text-lg">상품 추가</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* 기본 정보 */}
              <div className="flex gap-2 flex-wrap items-center">
                <Input className="flex-1 min-w-40" placeholder="상품명 *"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                <Input type="number" className="w-32" placeholder="가격(원)"
                  value={newProduct.price || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} />
                {buildCombinations(optionGroups).length === 0 ? (
                  <Input type="number" className="w-24" placeholder="재고"
                    value={newProduct.stock || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} />
                ) : (
                  newProductTotalStock > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-lg">
                      <span className="text-xs text-muted-foreground">총 재고</span>
                      <span className="text-sm font-bold text-primary">{newProductTotalStock.toLocaleString()}</span>
                    </div>
                  )
                )}
              </div>

              {/* 옵션 그룹 설정 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">옵션 그룹 <span className="text-muted-foreground font-normal">({optionGroups.length}/3) — 그룹이 2개 이상이면 조합을 자동 생성합니다</span></p>
                  {optionGroups.length < 3 && (
                    <Button size="sm" variant="outline"
                      onClick={() => setOptionGroups([...optionGroups, { name: '', values: [''] }])}>
                      <Plus className="w-3 h-3 mr-1" />옵션 추가
                    </Button>
                  )}
                </div>
                {optionGroups.map((grp, gi) => (
                  <div key={gi} className="p-3 border rounded-lg space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input className="w-40 h-8 text-sm" placeholder={`옵션${gi + 1} 이름 (예: 색상)`}
                        value={grp.name}
                        onChange={(e) => {
                          const gs = [...optionGroups]; gs[gi] = { ...gs[gi], name: e.target.value };
                          setOptionGroups(gs);
                        }} />
                      <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto"
                        onClick={() => setOptionGroups(optionGroups.filter((_, i) => i !== gi))}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                    <div className="pl-2 space-y-1">
                      {grp.values.map((val, vi) => (
                        <div key={vi} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{vi + 1}.</span>
                          <Input className="w-40 h-8 text-sm" placeholder={`값 입력 (예: 빨강)`}
                            value={val}
                            onChange={(e) => {
                              const gs = [...optionGroups];
                              gs[gi].values[vi] = e.target.value;
                              setOptionGroups([...gs]);
                            }} />
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => {
                              const gs = [...optionGroups];
                              gs[gi].values = gs[gi].values.filter((_, i) => i !== vi);
                              setOptionGroups([...gs]);
                            }}>
                            <X className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-primary"
                        onClick={() => {
                          const gs = [...optionGroups]; gs[gi].values.push('');
                          setOptionGroups([...gs]);
                        }}>
                        <Plus className="w-3 h-3 mr-1" />값 추가
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 조합 미리보기 + 재고 입력 */}
              {buildCombinations(optionGroups).length > 0 && (
                <div className="space-y-2 border rounded-lg p-3 bg-primary/5">
                  <p className="text-sm font-semibold text-primary">
                    생성될 옵션 조합 ({buildCombinations(optionGroups).length}개) — 각 조합의 재고를 입력하세요
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {buildCombinations(optionGroups).map((combo) => (
                      <div key={combo} className="flex items-center gap-2 bg-white border rounded px-2 py-1">
                        <span className="text-sm flex-1 font-medium">{combo}</span>
                        <Input type="number" className="w-16 h-7 text-sm"
                          placeholder="재고"
                          value={variantStocks[combo] ?? ''}
                          onChange={(e) => setVariantStocks({ ...variantStocks, [combo]: Number(e.target.value) })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleAddProduct} disabled={!newProduct.name}>
                <Plus className="w-4 h-4 mr-1" />상품 등록
              </Button>
            </CardContent>
          </Card>

          {/* 상품 목록 */}
          <Card>
            <CardHeader><CardTitle className="text-lg">상품 목록 ({products.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">등록된 상품이 없습니다.</p>
              )}
              {products.map((product) => (
                <div key={product.id} className="border rounded-lg overflow-hidden">
                  {/* 상품 행 */}
                  {editingProduct?.id === product.id ? (
                    <div className="flex items-center gap-2 p-3 bg-primary/5 flex-wrap">
                      <Input className="flex-1 min-w-32" value={editingProduct.name}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
                      <Input type="number" className="w-28" value={editingProduct.price}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })} />
                      <Input type="number" className="w-20" value={editingProduct.stock}
                        onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })} />
                      <Button size="icon" variant="ghost" onClick={handleUpdateProduct}><Check className="w-4 h-4 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingProduct(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {fmt(product.price)}
                            {product.options.length === 0
                              ? <span> | 재고: {product.stock}</span>
                              : <span> | 총 재고: <strong>{product.options.reduce((sum, o) => sum + o.stock, 0).toLocaleString()}</strong> <span className="text-xs text-muted-foreground">(상품별 단순 합계)</span></span>
                            }
                          </p>
                          {/* 옵션 조합 칩 */}
                          {product.options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {product.options.map((opt) =>
                                editingOption?.id === opt.id && editingOptionProductId === product.id ? (
                                  <div key={opt.id} className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5">
                                    <Input className="w-24 h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                                      value={editingOption.optionName}
                                      onChange={(e) => setEditingOption({ ...editingOption, optionName: e.target.value })} />
                                    <span className="text-xs text-muted-foreground">재고</span>
                                    <Input type="number" className="w-12 h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                                      value={editingOption.stock}
                                      onChange={(e) => setEditingOption({ ...editingOption, stock: Number(e.target.value) })} />
                                    <button onClick={() => handleUpdateOption(product.id)} className="text-green-600 hover:text-green-700"><Check className="w-3 h-3" /></button>
                                    <button onClick={() => { setEditingOption(null); setEditingOptionProductId(null); }}><X className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <div key={opt.id}
                                    className="group flex items-center gap-1 bg-gray-100 hover:bg-gray-200 rounded-full px-2.5 py-0.5 text-sm cursor-default transition-colors">
                                    <span className="font-medium">{opt.optionName}</span>
                                    <span className="text-muted-foreground text-xs">({opt.stock})</span>
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                                      onClick={() => { setEditingOption(opt); setEditingOptionProductId(product.id); }}>
                                      <Pencil className="w-2.5 h-2.5 text-gray-500" />
                                    </button>
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDeleteOption(product.id, opt.id)}>
                                      <X className="w-2.5 h-2.5 text-red-400" />
                                    </button>
                                  </div>
                                )
                              )}
                              {/* 옵션 추가 버튼 */}
                              {product.options.length < 3 && addingOptionFor !== product.id && (
                                <button
                                  className="flex items-center gap-1 border border-dashed border-gray-300 rounded-full px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                                  onClick={() => { setAddingOptionFor(product.id); setAddOptionGroups([{ name: '', values: [''] }]); setAddVariantStocks({}); }}>
                                  <Plus className="w-3 h-3" />옵션 추가
                                </button>
                              )}
                            </div>
                          )}
                          {product.options.length === 0 && addingOptionFor !== product.id && (
                            <button
                              className="mt-1 flex items-center gap-1 border border-dashed border-gray-300 rounded-full px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                              onClick={() => { setAddingOptionFor(product.id); setAddOptionGroups([{ name: '', values: [''] }]); setAddVariantStocks({}); }}>
                              <Plus className="w-3 h-3" />옵션 추가
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" title="AI 상세정보" onClick={() => openDetailDialog(product)}><Bot className="w-4 h-4 text-purple-500" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingProduct(product)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 기존 상품에 옵션 조합 추가 패널 */}
                  {addingOptionFor === product.id && (
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      <p className="text-sm font-semibold">옵션 그룹 설정 (현재 {product.options.length}/3개 사용 중)</p>
                      {addOptionGroups.map((grp, gi) => (
                        <div key={gi} className="p-3 border rounded-lg space-y-2 bg-white">
                          <div className="flex items-center gap-2">
                            <Input className="w-40 h-8 text-sm" placeholder={`옵션${gi + 1} 이름 (예: 색상)`}
                              value={grp.name}
                              onChange={(e) => { const gs = [...addOptionGroups]; gs[gi] = { ...gs[gi], name: e.target.value }; setAddOptionGroups(gs); }} />
                            {addOptionGroups.length < 2 && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto"
                                onClick={() => setAddOptionGroups([...addOptionGroups, { name: '', values: [''] }])}>
                                <Plus className="w-3 h-3 mr-1" />옵션 추가
                              </Button>
                            )}
                          </div>
                          <div className="pl-2 space-y-1">
                            {grp.values.map((val, vi) => (
                              <div key={vi} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-4">{vi + 1}.</span>
                                <Input className="w-40 h-8 text-sm" placeholder={`값 입력 (예: 빨강)`} value={val}
                                  onChange={(e) => { const gs = [...addOptionGroups]; gs[gi].values[vi] = e.target.value; setAddOptionGroups([...gs]); }} />
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  onClick={() => { const gs = [...addOptionGroups]; gs[gi].values = gs[gi].values.filter((_, i) => i !== vi); setAddOptionGroups([...gs]); }}>
                                  <X className="w-3 h-3 text-red-400" />
                                </Button>
                              </div>
                            ))}
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-primary"
                              onClick={() => { const gs = [...addOptionGroups]; gs[gi].values.push(''); setAddOptionGroups([...gs]); }}>
                              <Plus className="w-3 h-3 mr-1" />값 추가
                            </Button>
                          </div>
                        </div>
                      ))}
                      {buildCombinations(addOptionGroups).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">생성될 조합 ({Math.min(buildCombinations(addOptionGroups).length, 3 - product.options.length)}개 추가 가능)</p>
                          <div className="flex flex-wrap gap-2">
                            {buildCombinations(addOptionGroups).slice(0, 3 - product.options.length).map((combo) => (
                              <div key={combo} className="flex items-center gap-1 bg-white border rounded px-2 py-1">
                                <span className="text-sm">{combo}</span>
                                <Input type="number" className="w-14 h-6 text-xs" placeholder="재고"
                                  value={addVariantStocks[combo] ?? ''}
                                  onChange={(e) => setAddVariantStocks({ ...addVariantStocks, [combo]: Number(e.target.value) })} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAddOptionsToProduct(product.id)}
                          disabled={buildCombinations(addOptionGroups).length === 0}>
                          <Check className="w-4 h-4 mr-1" />옵션 저장
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingOptionFor(null)}>취소</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 계좌 설정 ── */}
        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">입금 방식 설정 <span className="text-red-500 text-sm">*</span></CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">주문서에서 고객에게 안내할 입금 방식을 선택하세요.</p>

              {/* 결제 방식 선택 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'personal', label: '개인계좌', desc: '직접 계좌번호 안내' },
                  { value: 'vbank',    label: '가상계좌', desc: '포트원 자동 발급' },
                  { value: 'both',     label: '모두 사용', desc: '두 방식 동시 제공' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: opt.value })}
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

              {/* 개인계좌 입력 */}
              {(form.paymentMethod === 'personal' || form.paymentMethod === 'both') && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">개인계좌 정보</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>은행명 <span className="text-red-500">*</span></Label>
                      <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="국민은행" />
                    </div>
                    <div className="space-y-2">
                      <Label>계좌번호 <span className="text-red-500">*</span></Label>
                      <Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="123-456-789012" />
                    </div>
                    <div className="space-y-2">
                      <Label>예금주 <span className="text-red-500">*</span></Label>
                      <Input value={form.bankHolder} onChange={(e) => setForm({ ...form, bankHolder: e.target.value })} placeholder="홍길동" />
                    </div>
                  </div>
                </div>
              )}

              {/* 가상계좌 안내 */}
              {(form.paymentMethod === 'vbank' || form.paymentMethod === 'both') && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" />가상계좌 (포트원)
                  </p>
                  <div className="space-y-2">
                    <Label className="text-blue-800">가맹점 식별코드 (IMP Key) <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.impKey}
                      onChange={(e) => setForm({ ...form, impKey: e.target.value })}
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
                  <p className="text-xs text-blue-700">
                    주문 시 고객마다 고유한 가상계좌 번호가 자동 발급됩니다.
                    입금 즉시 webhook으로 주문 상태가 자동 업데이트됩니다.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingSettings ? '저장 중...' : '저장'}
                </Button>
                {settingsMsg && (
                  <span className={`text-sm ${settingsMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    {settingsMsg.text}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 배송 정책 ── */}
        <TabsContent value="shipping" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">배송 정책</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">이 프로젝트의 배송 정책입니다. 주문폼 하단에 표시됩니다.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>배송 예정일 (영업일)</Label>
                  <Input
                    type="number"
                    value={form.shippingDays}
                    onChange={(e) => setForm({ ...form, shippingDays: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="예: 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label>교환 가능일</Label>
                  <Input
                    type="number"
                    value={form.exchangeDays}
                    onChange={(e) => setForm({ ...form, exchangeDays: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="예: 7"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingSettings ? '저장 중...' : '저장'}
                </Button>
                {settingsMsg && (
                  <span className={`text-sm ${settingsMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    {settingsMsg.text}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FAQ ── */}
        <TabsContent value="faq" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">FAQ 추가</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="질문을 입력하세요"
                value={newFaq.question}
                onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
              />
              <Input
                placeholder="답변을 입력하세요"
                value={newFaq.answer}
                onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
              />
              <Button onClick={handleAddFaq} disabled={!newFaq.question || !newFaq.answer} size="sm">
                <Plus className="w-4 h-4 mr-1" />FAQ 추가
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">FAQ 목록 ({faqs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {faqs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">등록된 FAQ가 없습니다.</p>
              )}
              {faqs.map((faq) =>
                editingFaq?.id === faq.id ? (
                  <div key={faq.id} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    <Input value={editingFaq.question} onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })} />
                    <Input value={editingFaq.answer} onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdateFaq}><Check className="w-4 h-4 mr-1" />저장</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingFaq(null)}><X className="w-4 h-4 mr-1" />취소</Button>
                    </div>
                  </div>
                ) : (
                  <div key={faq.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Q. {faq.question}</p>
                      <p className="text-sm text-muted-foreground mt-1">A. {faq.answer}</p>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => setEditingFaq(faq)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteFaq(faq.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI 상담 탭 ── */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          {/* 상품별 AI 상세정보 관리 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-500" />
                상품 AI 상세정보
              </CardTitle>
              <p className="text-sm text-muted-foreground">각 상품의 상세 설명 또는 파일(txt)을 등록하면 AI 상담에 활용됩니다.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{product.name}</p>
                    {(product as any).detail ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(product as any).detail.fileName && (
                          <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            <Upload className="h-2.5 w-2.5" />
                            {(product as any).detail.fileName}
                          </span>
                        )}
                        {(product as any).detail.description && (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <Check className="h-2.5 w-2.5" />
                            설명 등록됨
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">AI 정보 미등록</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openDetailDialog(product)}>
                    {(product as any).detail ? '수정' : '등록'}
                  </Button>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">상품 관리 탭에서 먼저 상품을 등록하세요.</p>
              )}
            </CardContent>
          </Card>

          {/* AI 상담 테스트 */}
          {project?.slug && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  AI 상담 테스트
                </CardTitle>
                <p className="text-sm text-muted-foreground">등록된 상품·프로젝트 정보를 바탕으로 AI 상담을 미리 테스트해보세요.</p>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden flex flex-col" style={{ height: '420px' }}>
                  {/* 메시지 영역 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {aiMessages.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center mt-8">메시지를 입력해 AI 상담을 테스트해보세요.</p>
                    )}
                    {aiMessages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                          ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-white border shadow-sm'}`}>
                          {msg.role === 'user'
                            ? <span className="text-xs font-bold">나</span>
                            : <Bot className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                          ${msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-white border shadow-sm text-gray-800 rounded-tl-sm'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-white border shadow-sm flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="bg-white border shadow-sm rounded-2xl px-3 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    <div ref={aiBottomRef} />
                  </div>
                  {/* 입력 */}
                  <div className="px-3 py-2.5 bg-white border-t flex gap-2">
                    <Input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          await handleAiSend();
                        }
                      }}
                      placeholder="질문을 입력하세요..."
                      disabled={aiLoading}
                      className="rounded-full text-sm"
                    />
                    <Button size="sm" onClick={handleAiSend} disabled={aiLoading || !aiInput.trim()} className="rounded-full h-9 w-9 p-0 flex-shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 상품 AI 상세정보 다이얼로그 */}
      {detailProductId !== null && (() => {
        const targetProduct = products.find((p) => p.id === detailProductId);
        const existingDetail = (targetProduct as any)?.detail;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailProductId(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">상품 AI 상세정보 등록</h3>
                <button onClick={() => setDetailProductId(null)}><X className="h-5 w-5" /></button>
              </div>

              {/* ── 현재 등록된 정보 ── */}
              {existingDetail && (
                <div className="border rounded-lg p-3 bg-purple-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-700">현재 등록된 AI 정보</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                      disabled={detailDeleting}
                      onClick={() => handleDetailDelete(detailProductId)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {detailDeleting ? '삭제 중...' : '삭제'}
                    </Button>
                  </div>
                  {existingDetail.fileName && (
                    <div className="flex items-center gap-1.5 text-sm text-purple-800">
                      <Upload className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="font-medium">파일:</span>
                      <span className="truncate">{existingDetail.fileName}</span>
                    </div>
                  )}
                  {existingDetail.description && (
                    <div className="text-sm text-purple-800">
                      <span className="font-medium">설명:</span>
                      <p className="mt-0.5 text-xs text-purple-700 line-clamp-3 whitespace-pre-wrap">{existingDetail.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── 새 정보 입력 ── */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{existingDetail ? '아래 내용을 수정 후 저장하면 기존 정보가 덮어씌워집니다.' : 'AI가 상담에 활용할 상품 정보를 입력하세요.'}</p>
                <div>
                  <Label>상세 설명 (직접 입력)</Label>
                  <textarea
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    rows={5}
                    placeholder="소재, 세탁 방법, 주의사항, 사이즈 정보 등 AI가 참고할 상세 내용을 입력하세요."
                    value={detailText}
                    onChange={(e) => setDetailText(e.target.value)}
                  />
                </div>
                <div>
                  <Label>파일 업로드 (txt, 최대 1MB)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      ref={detailFileRef}
                      type="file"
                      accept=".txt"
                      className="hidden"
                      onChange={(e) => setDetailFileName(e.target.files?.[0]?.name ?? null)}
                    />
                    <Button variant="outline" size="sm" onClick={() => detailFileRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" />파일 선택
                    </Button>
                    {detailFileName && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        {detailFileName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setDetailProductId(null)}>취소</Button>
                <Button disabled={detailSaving} onClick={async () => {
                  setDetailSaving(true);
                  try {
                    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3021';
                    const token = localStorage.getItem('token');
                    const fd = new FormData();
                    if (detailText) fd.append('description', detailText);
                    if (detailFileRef.current?.files?.[0]) fd.append('file', detailFileRef.current.files[0]);
                    await fetch(`${API_BASE}/products/${detailProductId}/detail-file`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                      body: fd,
                    });
                    await loadProducts();
                    setDetailProductId(null);
                  } catch (err: any) {
                    alert(`저장 오류: ${err.message}`);
                  } finally {
                    setDetailSaving(false);
                  }
                }}>
                  {detailSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

import { Suspense } from 'react';

export default function ProjectDetailPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-40 items-center justify-center text-muted-foreground">로딩 중...</div>}>
      <ProjectDetailPage />
    </Suspense>
  );
}
