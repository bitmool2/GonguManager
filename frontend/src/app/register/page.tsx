'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch, setToken } from '@/lib/api';
import { PLAN_CONFIG, PlanType } from '@/lib/plans';
import {
  Package, Check, X, ChevronLeft, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';

const SUBSCRIPTION_PLANS: PlanType[] = ['free', 'basic', 'pro', 'biz'];
const PASS_PLANS: PlanType[] = ['pass_1', 'pass_3', 'pass_10'];

type Step = 'info' | 'plan' | 'payment';

declare global { interface Window { IMP: any; } }

/* ── 플랜 카드 행 ── */
function PlanRow({ label, value, highlight }: {
  label: string;
  value: boolean | number | string;
  highlight?: boolean;
}) {
  const isNum = typeof value === 'number';
  const isBool = typeof value === 'boolean';
  const ok = value === true || (isNum && value !== 0) || value === 'view';
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {isBool ? (
        ok
          ? <Check className={`w-4 h-4 ${highlight ? 'text-primary' : 'text-green-500'}`} />
          : <X className="w-4 h-4 text-gray-300" />
      ) : (
        <span className={`text-xs font-semibold ${
          isNum && value === 0 ? 'text-gray-300' :
          highlight ? 'text-primary' : 'text-foreground'
        }`}>
          {isNum
            ? value === -1 ? '무제한' : value === 0 ? '—' : `${value.toLocaleString()}건`
            : value}
        </span>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep]             = useState<Step>('info');
  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('free');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [registeredToken, setRegisteredToken] = useState('');

  /* PortOne SDK */
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://cdn.iamport.kr/v1/iamport.js'; s.async = true;
    document.body.appendChild(s);
    return () => { document.body.removeChild(s); };
  }, []);

  /* 이메일 중복 확인 (debounce 600ms) */
  useEffect(() => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('idle'); return;
    }
    setEmailStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean }>(`/auth/check-email?email=${encodeURIComponent(email)}`);
        setEmailStatus(res.available ? 'ok' : 'taken');
      } catch { setEmailStatus('idle'); }
    }, 600);
    return () => clearTimeout(t);
  }, [email]);

  const pwValid = password.length >= 6 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
  const pwMatch = passwordConfirm === '' || password === passwordConfirm;
  const canSubmit =
    name.trim() !== '' &&
    emailStatus === 'ok' &&
    pwValid &&
    password === passwordConfirm;

  /* Step 1 제출 */
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(''); setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setRegisteredToken(res.token);
      setStep('plan');
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally { setLoading(false); }
  };

  /* Step 2 확인 */
  const handlePlanConfirm = () => {
    if (selectedPlan === 'free') { setToken(registeredToken); router.push('/projects'); return; }
    setStep('payment');
  };

  /* Step 3 결제 */
  const handlePayment = () => {
    if (!window.IMP) { setError('결제 모듈을 불러오지 못했습니다.'); return; }
    const plan = PLAN_CONFIG[selectedPlan];
    window.IMP.init('imp00000000');
    window.IMP.request_pay(
      { pg: 'html5_inicis', pay_method: 'card', merchant_uid: `plan_${Date.now()}`,
        name: `공구매니저 ${plan.name}`, amount: plan.price, buyer_email: email, buyer_name: name },
      async (rsp: any) => {
        if (rsp.success) {
          try {
            localStorage.setItem('token', registeredToken);
            await apiFetch('/subscriptions/upgrade', { method: 'POST',
              body: JSON.stringify({ planType: selectedPlan, impUid: rsp.imp_uid }) });
            setToken(registeredToken); router.push('/projects');
          } catch (err: any) { setError(err.message || '플랜 적용 오류'); }
        } else { setError(`결제 실패: ${rsp.error_msg}`); }
      },
    );
  };

  const planConfig = PLAN_CONFIG[selectedPlan];

  /* ── 렌더 ── */
  return (
    <div className="min-h-screen bg-gray-50 text-foreground flex flex-col items-center justify-start pt-10 pb-16 px-4">
      <div className="w-full max-w-5xl space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-2 justify-center">
          <Package className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold text-primary">공구매니저</h1>
        </div>

        {/* 스텝 */}
        <div className="flex items-center justify-center gap-2">
          {(['info','plan','payment'] as Step[]).map((s,i) => {
            const labels = ['기본 정보','플랜 선택','결제'];
            const active = step === s;
            const done = ['info','plan','payment'].indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-border" />}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active ? 'bg-primary text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'
                }`}>
                  {done ? <Check className="w-3 h-3" /> : <span>{i+1}</span>}
                  {labels[i]}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>
        )}

        {/* ── STEP 1: 기본 정보 ── */}
        {step === 'info' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl p-8 space-y-5 border border-border shadow-sm">
              <div>
                <h2 className="text-xl font-bold">기본 정보 입력</h2>
                <p className="text-sm text-muted-foreground mt-1">계정을 만들고 플랜을 선택하세요</p>
              </div>
              <form onSubmit={handleInfoSubmit} className="space-y-4">
                {/* 이름 */}
                <div className="space-y-1.5">
                  <Label>이름</Label>
                  <Input
                    placeholder="홍길동" value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* 이메일 + 중복확인 */}
                <div className="space-y-1.5">
                  <Label>이메일</Label>
                  <div className="relative">
                    <Input
                      type="email" placeholder="seller@example.com" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`pr-8 ${
                        emailStatus === 'taken' ? 'border-red-500' :
                        emailStatus === 'ok' ? 'border-green-500' : ''
                      }`}
                      required
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {emailStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {emailStatus === 'ok'       && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {emailStatus === 'taken'    && <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                  {emailStatus === 'taken' && (
                    <p className="text-xs text-red-500">이미 사용 중인 이메일입니다.</p>
                  )}
                  {emailStatus === 'ok' && (
                    <p className="text-xs text-green-600">사용 가능한 이메일입니다.</p>
                  )}
                </div>

                {/* 비밀번호 */}
                <div className="space-y-1.5">
                  <Label>비밀번호</Label>
                  <Input
                    type="password" placeholder="영문+숫자 조합 6자 이상" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={password && !pwValid ? 'border-red-500' : password && pwValid ? 'border-green-500' : ''}
                    required minLength={6}
                  />
                  {password && !pwValid && (
                    <p className="text-xs text-red-500">영문과 숫자를 모두 포함하여 6자 이상 입력해주세요.</p>
                  )}
                </div>

                {/* 비밀번호 확인 */}
                <div className="space-y-1.5">
                  <Label>비밀번호 확인</Label>
                  <div className="relative">
                    <Input
                      type="password" placeholder="비밀번호를 다시 입력하세요" value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className={`pr-8 ${
                        !pwMatch ? 'border-red-500' : (passwordConfirm && pwMatch ? 'border-green-500' : '')
                      }`}
                      required
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {passwordConfirm && pwMatch  && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {passwordConfirm && !pwMatch && <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                  {!pwMatch && <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />처리 중...</> : '다음 단계 →'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  이미 계정이 있으신가요?{' '}
                  <Link href="/login" className="text-primary hover:underline">로그인</Link>
                </p>
              </form>
            </div>
          </div>
        )}

        {/* ── STEP 2: 플랜 선택 ── */}
        {step === 'plan' && (
          <div className="space-y-8">
            {/* 월 구독형 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">월 구독형 — 공구를 규칙적으로 운영하는 셀러</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SUBSCRIPTION_PLANS.map((pt) => {
                  const cfg = PLAN_CONFIG[pt];
                  const active = selectedPlan === pt;
                  const isPro = pt === 'pro';
                  return (
                    <button key={pt} onClick={() => setSelectedPlan(pt)}
                      className={`relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                          : isPro
                          ? 'border-primary/40 bg-white hover:border-primary/70'
                          : 'border-border bg-white hover:border-gray-300'
                      }`}
                    >
                      {cfg.badge && (
                        <span className="absolute -top-3 right-4 bg-primary text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                          {cfg.badge}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-muted-foreground">{cfg.name}</p>
                      <p className={`text-2xl font-extrabold mt-0.5 ${active || isPro ? 'text-primary' : 'text-foreground'}`}>
                        {cfg.price === 0 ? '0' : cfg.price.toLocaleString()}
                        <span className="text-sm font-normal text-muted-foreground">원/월</span>
                      </p>

                      <div className="mt-4 space-y-0 flex-1">
                        <PlanRow label="월 공구 수" highlight={active}
                          value={cfg.maxProjects === -1 ? '무제한' : `${cfg.maxProjects}개`} />
                        <PlanRow label="월 주문 한도" highlight={active}
                          value={`${cfg.maxOrdersPerMonth}건`} />
                        <PlanRow label="입금 자동매칭" value={cfg.features.autoPaymentMatch} highlight={active} />
                        <PlanRow label="알림톡 발송" highlight={active}
                          value={cfg.features.kakaoNotification === 0 ? false :
                            cfg.features.kakaoNotification === -1 ? '무제한' :
                            `${cfg.features.kakaoNotification}건 포함`} />
                        <PlanRow label="엑셀 다운로드" value={cfg.features.excelDownload} highlight={active} />
                        <PlanRow label="구매자 CRM" value={cfg.features.buyerCRM === true ? true : cfg.features.buyerCRM === 'view' ? '조회만' : false} highlight={active} />
                        <PlanRow label="AI 공지문" highlight={active}
                          value={cfg.features.aiAnnouncement === 0 ? false :
                            cfg.features.aiAnnouncement === -1 ? '무제한' :
                            `월 ${cfg.features.aiAnnouncement}회`} />
                        <PlanRow label="공구 복사" value={cfg.features.projectCopy} highlight={active} />
                      </div>

                      {active && (
                        <div className="mt-3 pt-3 border-t border-primary/30">
                          <span className="text-xs text-primary font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> 선택됨
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 구독형은 한도 초과 시 공통 종량 과금이 자동 적용됩니다. 한도 내에서 쓰면 정액 요금만 청구됩니다.
              </p>
            </div>

            {/* 건당 구매형 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">건당 구매형 — 공구가 비정기적이거나 소량인 셀러</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PASS_PLANS.map((pt) => {
                  const cfg = PLAN_CONFIG[pt];
                  const active = selectedPlan === pt;
                  const origPrices: Partial<Record<PlanType, number>> = { pass_3: 29700, pass_10: 99000 };
                  const orig = origPrices[pt];
                  return (
                    <button key={pt} onClick={() => setSelectedPlan(pt)}
                      className={`relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                          : 'border-border bg-white hover:border-gray-300'
                      }`}
                    >
                      {cfg.badge && (
                        <span className={`absolute -top-3 right-4 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          cfg.badge === '인기' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}>
                          {cfg.badge}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-muted-foreground">{cfg.name}</p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <p className={`text-2xl font-extrabold ${active ? 'text-primary' : 'text-foreground'}`}>
                          {cfg.price.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground">원</span>
                        </p>
                        {orig && <span className="text-sm text-muted-foreground line-through">{orig.toLocaleString()}원</span>}
                      </div>
                      {pt === 'pass_3' && <p className="text-xs text-blue-500 mt-0.5">회당 8,300원 · 16% 절약</p>}
                      {pt === 'pass_10' && <p className="text-xs text-purple-500 mt-0.5">회당 6,990원 · 29% 절약</p>}

                      <div className="mt-4 flex-1">
                        <PlanRow label="유효 기간" highlight={active}
                          value={cfg.passExpiryDays ? `구매 후 ${cfg.passExpiryDays}일` : '공구 마감까지'} />
                        <PlanRow label="주문 한도" highlight={active} value={`회당 ${cfg.passOrderLimit}건`} />
                        <PlanRow label="입금 자동매칭" value={true} highlight={active} />
                        <PlanRow label="알림톡 발송" highlight={active} value={`회당 ${cfg.features.kakaoNotification}건`} />
                        <PlanRow label="엑셀 다운로드" value={true} highlight={active} />
                        <PlanRow label="구매자 CRM" value={cfg.features.buyerCRM === 'view' ? '조회만' : cfg.features.buyerCRM} highlight={active} />
                        <PlanRow label="AI 공지문" highlight={active}
                          value={cfg.features.aiAnnouncement > 0 ? `회당 ${cfg.features.aiAnnouncement}회` : false} />
                        <PlanRow label="공구 복사" value={cfg.features.projectCopy} highlight={active} />
                      </div>

                      {active && (
                        <div className="mt-3 pt-3 border-t border-primary/30">
                          <span className="text-xs text-primary font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> 선택됨
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 건당 구매형도 주문 한도 초과 시 공통 종량 과금이 적용됩니다. 회차는 공구 생성 시 1회 차감됩니다.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('info')} className="w-28">
                <ChevronLeft className="w-4 h-4 mr-1" />이전
              </Button>
              <Button onClick={handlePlanConfirm} className="flex-1 text-base py-5">
                {selectedPlan === 'free' ? '프리로 시작하기 →' : `${planConfig.name} 선택 및 결제 →`}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 결제 ── */}
        {step === 'payment' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl p-8 space-y-6 border border-border shadow-sm">
              <div>
                <h2 className="text-xl font-bold">결제 확인</h2>
                <p className="text-sm text-muted-foreground mt-1">선택한 플랜으로 결제를 진행합니다</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">플랜</span>
                  <span className="font-semibold">{planConfig.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">금액</span>
                  <span className="font-bold text-xl text-primary">{planConfig.price.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>결제 방식</span>
                  <span>{planConfig.billingType === 'monthly' ? '월 구독 (매달 갱신)' : `1회 결제 (${planConfig.passTotal}회권)`}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('plan')} className="w-28">
                  <ChevronLeft className="w-4 h-4 mr-1" />이전
                </Button>
                <Button onClick={handlePayment} className="flex-1">
                  {planConfig.price.toLocaleString()}원 결제하기
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
