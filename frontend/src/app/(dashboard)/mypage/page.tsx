'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PLAN_CONFIG, PlanType } from '@/lib/plans';
import { apiFetch, getUserEmailFromToken } from '@/lib/api';
import {
  User, CreditCard, BarChart3, Check, X, Zap, RefreshCw, Crown,
} from 'lucide-react';

declare global { interface Window { IMP: any; } }

const PLAN_ORDER: PlanType[] = ['free', 'basic', 'pro', 'biz'];
const PASS_PLANS: PlanType[] = ['pass_1', 'pass_3', 'pass_10'];

function PlanBadge({ planType }: { planType: PlanType }) {
  const colors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    basic: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    biz: 'bg-amber-100 text-amber-700',
    pass_1: 'bg-green-100 text-green-700',
    pass_3: 'bg-green-100 text-green-700',
    pass_10: 'bg-green-100 text-green-700',
  };
  const plan = PLAN_CONFIG[planType];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold ${colors[planType] || 'bg-gray-100'}`}>
      {planType !== 'free' && <Crown className="w-3.5 h-3.5" />}
      {plan?.name ?? planType}
    </span>
  );
}

function FeatureRow({ label, value }: { label: string; value: boolean | number | string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {typeof value === 'boolean' ? (
        value ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-gray-300" />
      ) : typeof value === 'number' ? (
        <span className={`text-sm font-medium ${value === 0 ? 'text-gray-300' : 'text-foreground'}`}>
          {value === -1 ? '무제한' : value === 0 ? '미포함' : `${value}건`}
        </span>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

/* 플랜 변경 카드 내부 행 */
function PlanRow({ label, value, highlight }: {
  label: string; value: boolean | number | string; highlight?: boolean;
}) {
  const isBool = typeof value === 'boolean';
  const isNum  = typeof value === 'number';
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/60 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {isBool ? (
        value
          ? <Check className={`w-3.5 h-3.5 ${highlight ? 'text-primary' : 'text-green-500'}`} />
          : <X className="w-3.5 h-3.5 text-muted-foreground/30" />
      ) : (
        <span className={`text-[11px] font-semibold ${
          isNum && value === 0 ? 'text-muted-foreground/30' :
          highlight ? 'text-primary' : 'text-foreground'
        }`}>
          {isNum ? (value === -1 ? '무제한' : value === 0 ? '—' : String(value)) : String(value)}
        </span>
      )}
    </div>
  );
}

export default function MyPage() {
  const { usageInfo, planType, loading, refresh } = useSubscription();
  const [userEmail, setUserEmail] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');

  useEffect(() => {
    setUserEmail(getUserEmailFromToken() ?? '');
    const script = document.createElement('script');
    script.src = 'https://cdn.iamport.kr/v1/iamport.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const plan = PLAN_CONFIG[planType];
  const sub  = usageInfo?.subscription;
  const usage = usageInfo?.usage;

  const handleUpgrade = (targetPlan: PlanType) => {
    if (!window.IMP) { setUpgradeError('결제 모듈을 불러오지 못했습니다.'); return; }
    const cfg = PLAN_CONFIG[targetPlan];
    window.IMP.init('imp00000000');
    setUpgrading(true);
    setUpgradeError('');
    window.IMP.request_pay(
      { pg: 'html5_inicis', pay_method: 'card', merchant_uid: `plan_${Date.now()}`,
        name: `공구매니저 ${cfg.name}`, amount: cfg.price, buyer_email: userEmail },
      async (rsp: any) => {
        if (rsp.success) {
          try {
            await apiFetch('/subscriptions/upgrade', { method: 'POST',
              body: JSON.stringify({ planType: targetPlan, impUid: rsp.imp_uid }) });
            await refresh();
          } catch (err: any) { setUpgradeError(err.message || '플랜 적용 실패'); }
        } else { setUpgradeError(`결제 실패: ${rsp.error_msg}`); }
        setUpgrading(false);
      },
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const projectPct = usage && usage.projects.limit > 0
    ? Math.min(100, Math.round((usage.projects.used / usage.projects.limit) * 100)) : 0;
  const orderPct = usage && usage.orders.limit > 0
    ? Math.min(100, Math.round((usage.orders.used / usage.orders.limit) * 100)) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="text-muted-foreground">계정 정보와 구독 현황을 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 기본 정보 */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />기본 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">이메일</p>
              <p className="text-sm font-medium break-all">{userEmail || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">현재 플랜</p>
              <div className="mt-1"><PlanBadge planType={planType} /></div>
            </div>
            {sub?.endDate && (
              <div>
                <p className="text-xs text-muted-foreground">만료일</p>
                <p className="text-sm font-medium">{new Date(sub.endDate).toLocaleDateString('ko-KR')}</p>
              </div>
            )}
            {sub && plan.billingType === 'pass' && (
              <div>
                <p className="text-xs text-muted-foreground">이용권 현황</p>
                <p className="text-sm font-medium">
                  {sub.passUsed} / {sub.passTotal}회 사용
                  {sub.passExpiry && ` (${new Date(sub.passExpiry).toLocaleDateString('ko-KR')} 만료)`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 현재 플랜 기능 */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500" />현재 플랜 기능
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureRow label="월 공구(프로젝트) 수" value={plan.maxProjects === -1 ? '무제한' : `${plan.maxProjects}개`} />
            <FeatureRow label="월 주문 한도" value={`${plan.billingType === 'pass' ? plan.passOrderLimit : plan.maxOrdersPerMonth}건`} />
            <FeatureRow label="입금 자동매칭" value={plan.features.autoPaymentMatch} />
            <FeatureRow label="알림톡 발송" value={plan.features.kakaoNotification} />
            <FeatureRow label="엑셀 다운로드" value={plan.features.excelDownload} />
            <FeatureRow label="구매자 CRM" value={plan.features.buyerCRM === 'view' ? '조회만' : plan.features.buyerCRM ? '✓' : false} />
            <FeatureRow label="AI 공지문" value={plan.features.aiAnnouncement === -1 ? '무제한' : plan.features.aiAnnouncement === 0 ? false : `${plan.features.aiAnnouncement}회/월`} />
            <FeatureRow label="공구 복사" value={plan.features.projectCopy} />
          </CardContent>
        </Card>
      </div>

      {/* 사용량 */}
      {usage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-500" />이번 달 사용량
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>프로젝트</span>
                <span className="font-medium">{usage.projects.used} / {usage.projects.limit === -1 ? '무제한' : usage.projects.limit}개</span>
              </div>
              {usage.projects.limit > 0 && <Progress value={projectPct} className="h-2" />}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>주문</span>
                <span className={`font-medium ${orderPct >= 90 ? 'text-red-500' : ''}`}>
                  {usage.orders.used} / {usage.orders.limit}건
                </span>
              </div>
              <Progress value={orderPct} className={`h-2 ${orderPct >= 90 ? '[&>div]:bg-red-500' : ''}`} />
              {orderPct >= 80 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Zap className="w-3 h-3" />한도의 {orderPct}% 사용 중입니다. 초과 시 건당 100원이 추가 청구됩니다.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 플랜 변경 */}
      {upgradeError && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{upgradeError}</div>
      )}
      <div className="rounded-2xl bg-muted/40 border border-border p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-semibold">플랜 변경</h2>
          <span className="text-xs text-muted-foreground">현재: {PLAN_CONFIG[planType]?.name}</span>
        </div>

        {/* 월 구독형 */}
        <div>
          <p className="text-xs text-muted-foreground mb-3">월 구독형 — 공구를 규칙적으로 운영하는 셀러</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PLAN_ORDER.map((pt) => {
              const cfg = PLAN_CONFIG[pt];
              const isCurrent = pt === planType;
              const isPro = pt === 'pro';
              return (
                <button key={pt}
                  disabled={upgrading || isCurrent || pt === 'free'}
                  onClick={() => handleUpgrade(pt)}
                  className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all bg-background ${
                    isCurrent
                      ? 'border-primary shadow-sm cursor-default'
                      : pt === 'free'
                      ? 'border-border opacity-40 cursor-not-allowed'
                      : isPro
                      ? 'border-primary/30 hover:border-primary hover:shadow-md'
                      : 'border-border hover:border-muted-foreground/50 hover:shadow-sm'
                  }`}
                >
                  {isCurrent ? (
                    <span className="absolute -top-2.5 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" />현재
                    </span>
                  ) : cfg.badge && (
                    <span className="absolute -top-2.5 right-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {cfg.badge}
                    </span>
                  )}
                  <p className="text-xs font-semibold text-muted-foreground">{cfg.name}</p>
                  <p className={`text-lg font-extrabold mt-0.5 ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                    {cfg.price === 0 ? '무료' : cfg.price.toLocaleString()}
                    {cfg.price > 0 && <span className="text-xs font-normal text-muted-foreground">원/월</span>}
                  </p>
                  <div className="mt-3">
                    <PlanRow label="공구 수" value={cfg.maxProjects === -1 ? '무제한' : `${cfg.maxProjects}개`} highlight={isCurrent} />
                    <PlanRow label="월 주문" value={`${cfg.maxOrdersPerMonth}건`} highlight={isCurrent} />
                    <PlanRow label="자동매칭" value={cfg.features.autoPaymentMatch} highlight={isCurrent} />
                    <PlanRow label="엑셀" value={cfg.features.excelDownload} highlight={isCurrent} />
                    <PlanRow label="AI 공지문" highlight={isCurrent}
                      value={cfg.features.aiAnnouncement === 0 ? false :
                        cfg.features.aiAnnouncement === -1 ? '무제한' :
                        `월 ${cfg.features.aiAnnouncement}회`} />
                    <PlanRow label="공구 복사" value={cfg.features.projectCopy} highlight={isCurrent} />
                  </div>
                  {!isCurrent && pt !== 'free' && (
                    <div className="mt-3 pt-2 border-t border-border">
                      <span className="text-[10px] text-primary font-semibold">변경하기 →</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 건당 구매형 */}
        <div>
          <p className="text-xs text-muted-foreground mb-3">건당 구매형 — 공구가 비정기적이거나 소량인 셀러</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PASS_PLANS.map((pt) => {
              const cfg = PLAN_CONFIG[pt];
              const isCurrent = pt === planType;
              const origPrices: Partial<Record<PlanType, number>> = { pass_3: 29700, pass_10: 99000 };
              const orig = origPrices[pt];
              return (
                <button key={pt}
                  disabled={upgrading || isCurrent}
                  onClick={() => handleUpgrade(pt)}
                  className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all bg-background ${
                    isCurrent
                      ? 'border-primary shadow-sm cursor-default'
                      : 'border-border hover:border-muted-foreground/50 hover:shadow-sm'
                  }`}
                >
                  {isCurrent ? (
                    <span className="absolute -top-2.5 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" />현재
                    </span>
                  ) : cfg.badge && (
                    <span className={`absolute -top-2.5 right-3 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      cfg.badge === '인기' ? 'bg-blue-500' : 'bg-purple-500'
                    }`}>{cfg.badge}</span>
                  )}
                  <p className="text-xs font-semibold text-muted-foreground">{cfg.name}</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <p className={`text-lg font-extrabold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                      {cfg.price.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">원</span>
                    </p>
                    {orig && <span className="text-xs text-muted-foreground/50 line-through">{orig.toLocaleString()}원</span>}
                  </div>
                  <div className="mt-3">
                    <PlanRow label="유효기간" highlight={isCurrent}
                      value={cfg.passExpiryDays ? `${cfg.passExpiryDays}일` : '마감까지'} />
                    <PlanRow label="회당 주문" highlight={isCurrent} value={`${cfg.passOrderLimit}건`} />
                    <PlanRow label="자동매칭" value={true} highlight={isCurrent} />
                    <PlanRow label="엑셀" value={true} highlight={isCurrent} />
                    <PlanRow label="AI 공지문" highlight={isCurrent}
                      value={cfg.features.aiAnnouncement > 0 ? `회당 ${cfg.features.aiAnnouncement}회` : false} />
                    <PlanRow label="공구 복사" value={cfg.features.projectCopy} highlight={isCurrent} />
                  </div>
                  {!isCurrent && (
                    <div className="mt-3 pt-2 border-t border-border">
                      <span className="text-[10px] text-primary font-semibold">구매하기 →</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-3">
            💡 종량 과금: 초과 주문 100원/건 · 알림톡 15원/건 · AI 공지문 500원/회 · 가상계좌 200원/건
          </p>
        </div>
      </div>

      {/* 개발용 테스트 */}
      {process.env.NODE_ENV !== 'production' && (
        <Card className="border-dashed border-orange-300 bg-orange-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <Zap className="w-4 h-4" />개발용 — 결제 없이 플랜 즉시 적용
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-orange-600 mb-3">⚠️ 개발/테스트 환경 전용. 프로덕션에서는 노출되지 않습니다.</p>
            <div className="flex flex-wrap gap-2">
              {(['free', 'basic', 'pro', 'biz', 'pass_1', 'pass_3', 'pass_10'] as PlanType[]).map((pt) => (
                <button key={pt}
                  onClick={async () => {
                    try {
                      await apiFetch('/subscriptions/dev/apply', { method: 'POST', body: JSON.stringify({ planType: pt }) });
                      await refresh();
                      alert(`✅ ${PLAN_CONFIG[pt].name} 적용 완료`);
                    } catch (e: any) { alert(`오류: ${e.message}`); }
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    planType === pt
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white border-orange-300 text-orange-700 hover:bg-orange-100'
                  }`}
                >
                  {PLAN_CONFIG[pt].name}{planType === pt && ' ✓'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
