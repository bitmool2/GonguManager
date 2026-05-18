'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { apiFetch } from '@/lib/api';
import { PLAN_CONFIG, PlanType, hasFeature, PlanFeatures } from '@/lib/plans';

export interface Subscription {
  id: number;
  userId: number;
  planType: PlanType;
  status: string;
  startDate: string;
  endDate?: string;
  passTotal?: number;
  passUsed: number;
  passExpiry?: string;
  ordersUsed: number;
  ordersResetAt: string;
}

export interface UsageInfo {
  subscription: Subscription;
  plan: (typeof PLAN_CONFIG)[PlanType];
  usage: {
    projects: { used: number; limit: number };
    orders: { used: number; limit: number };
  };
}

interface SubscriptionContextValue {
  subscription: Subscription | null;
  usageInfo: UsageInfo | null;
  planType: PlanType;
  loading: boolean;
  refresh: () => Promise<void>;
  can: (feature: keyof PlanFeatures) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  usageInfo: null,
  planType: 'free',
  loading: true,
  refresh: async () => {},
  can: () => false,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<UsageInfo>('/subscriptions/my/usage');
      setUsageInfo(data);
    } catch {
      // 비로그인 상태 등
      setUsageInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const planType: PlanType = (usageInfo?.subscription?.planType as PlanType) ?? 'free';

  const can = useCallback(
    (feature: keyof PlanFeatures) => hasFeature(planType, feature),
    [planType],
  );

  return (
    <SubscriptionContext.Provider
      value={{
        subscription: usageInfo?.subscription ?? null,
        usageInfo,
        planType,
        loading,
        refresh,
        can,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
