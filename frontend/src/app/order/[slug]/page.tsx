'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
import ChatWidget from '@/components/ChatWidget';
import { Package, CheckCircle, Banknote, Truck, Plus, Trash2, ShoppingCart, Clock } from 'lucide-react';

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
  options: ProductOption[];
}

interface CartItem {
  key: string;          // 고유 키 (productId-optionId-timestamp)
  product: Product;
  option: ProductOption | null;
  quantity: number;
}

interface ProjectInfo {
  name: string;
  description?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  shippingDays?: number;
  exchangeDays?: number;
  paymentMethod?: string;
  impKey?: string;
  products: Product[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3021';

export default function PublicOrderPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState('');

  /* 고객 정보 */
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [depositName, setDepositName] = useState('');

  /* 장바구니 */
  const [cart, setCart] = useState<CartItem[]>([]);

  /* 상품 추가 선택 폼 */
  const [pickProductId, setPickProductId] = useState('');
  const [pickOptionId, setPickOptionId] = useState('');
  const [pickQty, setPickQty] = useState<number | ''>('');
  const [addError, setAddError] = useState('');

  /* 완료 후 표시용 스냅샷 */
  const [submittedCart, setSubmittedCart] = useState<CartItem[]>([]);

  /* 제출 로딩 상태 */
  const [submitting, setSubmitting] = useState(false);

  /* 포트원 SDK 로딩 */
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).IMP) { setSdkLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.iamport.kr/v1/iamport.js';
    script.async = true;
    script.onload = () => setSdkLoaded(true);
    script.onerror = () => setSdkLoaded(false);
    document.head.appendChild(script);
  }, []);

  /* 가상계좌 발급 결과 */
  const [vbank, setVbank] = useState<{
    num: string;
    name: string;
    holder: string;
    expiry: string;
  } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/projects/public/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('주문폼을 찾을 수 없습니다.');
        return r.json();
      })
      .then(setProjectInfo)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const products = projectInfo?.products ?? [];
  const pickProduct = products.find((p) => p.id === Number(pickProductId));

  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n) + '원';
  const totalPrice = cart.reduce((s, item) => s + item.product.price * item.quantity, 0);

  /* ── 장바구니 추가 ── */
  const handleAddToCart = () => {
    setAddError('');
    if (!pickProduct) { setAddError('상품을 선택하세요.'); return; }
    if (pickProduct.options.length > 0 && !pickOptionId) { setAddError('옵션을 선택하세요.'); return; }
    if (!pickQty || Number(pickQty) < 1) { setAddError('수량을 입력하세요.'); return; }

    const option = pickProduct.options.find((o) => o.id === Number(pickOptionId)) ?? null;
    const key = `${pickProduct.id}-${pickOptionId}-${Date.now()}`;

    setCart((prev) => [...prev, { key, product: pickProduct, option, quantity: Number(pickQty) }]);
    setPickProductId('');
    setPickOptionId('');
    setPickQty('');
  };

  /* ── 장바구니 삭제 ── */
  const handleRemoveFromCart = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  /* ── 주문 제출 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (cart.length === 0) { setError('상품을 한 개 이상 추가하세요.'); return; }
    if (!customerName.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!phone.trim()) { setError('연락처를 입력해주세요.'); return; }

    const impKey = projectInfo?.impKey;
    const pm = projectInfo?.paymentMethod ?? 'personal';
    const useVbank = (pm === 'vbank' || pm === 'both') && impKey && impKey !== 'imp_xxxxxxxxxx';

    setSubmitting(true);
    try {
      /* 1. 백엔드에 주문 생성 */
      const res = await fetch(`${API_BASE}/public/orders/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phone,
          address,
          depositName,
          items: cart.map((item) => ({
            productId: item.product.id,
            optionId: item.option?.id ?? undefined,
            quantity: item.quantity,
          })),
        }),
      });
      if (!res.ok) throw new Error('주문 처리에 실패했습니다.');
      const orderData = await res.json();

      /* 2. 개인계좌 전용 or SDK 미로드 → 바로 완료 */
      if (!useVbank || !sdkLoaded) {
        setSubmittedCart(cart);
        setOrderNumber(orderData.orderNumber);
        setSubmitted(true);
        return;
      }

      /* 3. 포트원 가상계좌 발급 */
      const IMP = (window as any).IMP;
      if (!IMP) throw new Error('포트원 SDK를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      IMP.init(impKey);

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 3); // 3일 후 만료
      const vbankDue = expiry.toISOString().slice(0, 10).replace(/-/g, '');

      IMP.request_pay(
        {
          pg: 'html5_inicis',
          pay_method: 'vbank',
          merchant_uid: orderData.orderNumber,
          name: `${projectInfo?.name ?? '공구'} 주문`,
          amount: orderData.totalPrice,
          buyer_name: customerName,
          buyer_tel: phone,
          vbank_due: vbankDue,
        },
        async (rsp: any) => {
          if (rsp.success) {
            /* 4. 가상계좌 정보를 백엔드에 저장 */
            await fetch(`${API_BASE}/portone/vbank-issued`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderNumber: orderData.orderNumber,
                imp_uid: rsp.imp_uid,
                vbank_num: rsp.vbank_num,
                vbank_name: rsp.vbank_name,
                vbank_holder: rsp.vbank_holder,
                vbank_date: rsp.vbank_date,
              }),
            });

            setVbank({
              num: rsp.vbank_num,
              name: rsp.vbank_name,
              holder: rsp.vbank_holder,
              expiry: rsp.vbank_date
                ? new Date(rsp.vbank_date * 1000).toLocaleDateString('ko-KR')
                : vbankDue,
            });
            setSubmittedCart(cart);
            setOrderNumber(orderData.orderNumber);
            setSubmitted(true);
          } else {
            setError(rsp.error_msg || '가상계좌 발급에 실패했습니다.');
          }
        },
      );
    } catch (err: any) {
      setError(err.message || '주문 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  /* ── 완료 화면 ── */
  if (submitted) {
    const settings = projectInfo;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">주문 완료!</h2>
            <p className="text-muted-foreground mb-4">주문이 성공적으로 접수되었습니다.</p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">주문번호</p>
              <p className="text-lg font-mono font-bold">{orderNumber}</p>
            </div>

            {/* 가상계좌 발급 정보 (포트원) */}
            {vbank && (
              <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 mb-4">
                <p className="text-sm font-semibold text-blue-800 flex items-center gap-1">
                  <Banknote className="w-4 h-4" />입금 가상계좌 안내
                </p>
                <div className="space-y-1">
                  <p className="text-sm"><span className="text-muted-foreground">은행: </span><strong>{vbank.name}</strong></p>
                  <p className="text-sm"><span className="text-muted-foreground">계좌번호: </span><strong className="font-mono text-base">{vbank.num}</strong></p>
                  <p className="text-sm"><span className="text-muted-foreground">예금주: </span><strong>{vbank.holder}</strong></p>
                  <p className="text-sm flex items-center gap-1 text-orange-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">{vbank.expiry}까지 입금하세요</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  입금 확인 후 자동으로 주문 상태가 변경됩니다.
                </p>
              </div>
            )}

            {/* 개인계좌 안내 (personal / both) */}
            {(projectInfo?.paymentMethod === 'personal' || projectInfo?.paymentMethod === 'both' || !projectInfo?.paymentMethod) &&
              projectInfo?.bankName && (
              <div className="text-left bg-green-50 border border-green-200 rounded-lg p-4 space-y-1 mb-4">
                <p className="text-sm font-semibold text-green-800 flex items-center gap-1">
                  <Banknote className="w-4 h-4" />입금 계좌 안내
                </p>
                <p className="text-sm"><span className="text-muted-foreground">은행: </span><strong>{projectInfo.bankName}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">계좌번호: </span><strong>{projectInfo.bankAccount}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">예금주: </span><strong>{projectInfo.bankHolder}</strong></p>
              </div>
            )}

            {/* 구매항목 요약 */}
            {submittedCart.length > 0 && (
              <div className="text-left border rounded-lg overflow-hidden mb-4">
                <div className="px-4 py-2 bg-muted/60 border-b flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span className="text-sm font-semibold">구매항목</span>
                </div>
                <div className="divide-y">
                  {submittedCart.map((item) => (
                    <div key={item.key} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        {item.option && (
                          <p className="text-xs text-muted-foreground">옵션: {item.option.optionName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {fmt(item.product.price)} × {item.quantity}개
                        </p>
                      </div>
                      <span className="font-semibold text-sm whitespace-nowrap">
                        {fmt(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 bg-muted/30 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">총 결제금액</span>
                    <span className="font-bold text-primary">
                      {fmt(submittedCart.reduce((s, i) => s + i.product.price * i.quantity, 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">입금 확인 후 배송이 시작됩니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings = projectInfo;

  /* ── 주문 폼 ── */
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* 포트원 SDK */}
      <div className="max-w-lg mx-auto space-y-4">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Package className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{projectInfo?.name ? `${projectInfo.name} 주문서` : '주문서'}</h1>
          {projectInfo?.description && (
            <p className="text-muted-foreground text-sm mt-1">{projectInfo.description}</p>
          )}
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── 고객 정보 ── */}
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base">주문자 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>이름 *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>연락처 *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>주소 *</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>입금자명 *</Label>
                <Input value={depositName} onChange={(e) => setDepositName(e.target.value)} required />
              </div>
            </CardContent>
          </Card>

          {/* ── 상품 추가 ── */}
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />상품 추가
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>상품 선택</Label>
                <Select value={pickProductId} onValueChange={(v) => { setPickProductId(v); setPickOptionId(''); }}>
                  <SelectTrigger><SelectValue placeholder="상품을 선택하세요" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — {fmt(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pickProduct && pickProduct.options.length > 0 && (
                <div className="space-y-1.5">
                  <Label>옵션 선택</Label>
                  <Select value={pickOptionId} onValueChange={setPickOptionId}>
                    <SelectTrigger><SelectValue placeholder="옵션을 선택하세요" /></SelectTrigger>
                    <SelectContent>
                      {pickProduct.options.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          {opt.optionName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>수량</Label>
                <Input
                  type="number"
                  min={1}
                  value={pickQty}
                  onChange={(e) => setPickQty(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              {addError && <p className="text-xs text-red-500">{addError}</p>}

              <Button type="button" variant="outline" className="w-full" onClick={handleAddToCart}>
                <Plus className="w-4 h-4 mr-2" />장바구니에 추가
              </Button>
            </CardContent>
          </Card>

          {/* ── 구매항목 (장바구니) ── */}
          <Card className={cart.length === 0 ? 'border-dashed' : ''}>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                구매항목
                {cart.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({cart.length}종)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  위에서 상품을 추가하세요
                </p>
              ) : (
                <div className="divide-y border rounded-lg overflow-hidden">
                  {cart.map((item) => (
                    <div key={item.key} className="flex items-start gap-3 px-3 py-3">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        {item.option && (
                          <p className="text-xs text-muted-foreground">옵션: {item.option.optionName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {fmt(item.product.price)} × {item.quantity}개
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold text-sm whitespace-nowrap">
                          {fmt(item.product.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.key)}
                          className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="px-3 py-2.5 bg-muted/30 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">총 결제금액</span>
                    <span className="text-lg font-bold text-primary">{fmt(totalPrice)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 계좌 정보 */}
          {(projectInfo?.paymentMethod === 'personal' || projectInfo?.paymentMethod === 'both' || !projectInfo?.paymentMethod) &&
            settings?.bankName && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                  <Banknote className="w-4 h-4" />입금 계좌 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground w-16">은행</span>
                  <strong>{settings.bankName}</strong>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground w-16">계좌번호</span>
                  <strong className="font-mono">{settings.bankAccount}</strong>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground w-16">예금주</span>
                  <strong>{settings.bankHolder}</strong>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 가상계좌 안내 (주문서 form 내) */}
          {(projectInfo?.paymentMethod === 'vbank' || projectInfo?.paymentMethod === 'both') && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2 text-purple-800">
                  <Banknote className="w-4 h-4" />가상계좌 결제
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-purple-700">
                  주문 제출 후 고객님 전용 가상계좌 번호가 자동 발급됩니다.
                  발급된 계좌로 입금하시면 자동으로 주문이 확인됩니다.
                </p>
              </CardContent>
            </Card>
          )}

          {/* 배송 정책 */}
          {(settings?.shippingDays || settings?.exchangeDays) && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2 text-green-800">
                  <Truck className="w-4 h-4" />배송 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-4">
                {settings?.shippingDays && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground w-24">배송 예정</span>
                    <span>입금 확인 후 <strong>{settings.shippingDays}영업일</strong> 이내 발송</span>
                  </div>
                )}
                {settings?.exchangeDays && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground w-24">교환/반품</span>
                    <span>수령 후 <strong>{settings.exchangeDays}일</strong> 이내</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={cart.length === 0 || submitting}>
            {submitting ? '처리 중...' : '주문하기'}
          </Button>
        </form>
      </div>

      {/* AI 상담 플로팅 위젯 */}
      <ChatWidget slug={slug} projectName={projectInfo?.name} />
    </div>
  );
}
