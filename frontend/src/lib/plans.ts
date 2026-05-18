export type PlanType =
  | 'free'
  | 'basic'
  | 'pro'
  | 'biz'
  | 'pass_1'
  | 'pass_3'
  | 'pass_10';

export interface PlanFeatures {
  autoPaymentMatch: boolean;
  kakaoNotification: number;
  excelDownload: boolean;
  buyerCRM: boolean | 'view';
  aiAnnouncement: number;
  projectCopy: boolean;
}

export interface PlanConfig {
  name: string;
  price: number;
  billingType: 'monthly' | 'pass' | 'free';
  maxProjects: number;
  maxOrdersPerMonth: number;
  passTotal?: number;
  passOrderLimit?: number;
  passExpiryDays?: number;
  badge?: string;
  features: PlanFeatures;
}

export const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  free: {
    name: '프리',
    price: 0,
    billingType: 'free',
    maxProjects: 1,
    maxOrdersPerMonth: 30,
    features: {
      autoPaymentMatch: false,
      kakaoNotification: 0,
      excelDownload: false,
      buyerCRM: false,
      aiAnnouncement: 0,
      projectCopy: false,
    },
  },
  basic: {
    name: '베이직',
    price: 19900,
    billingType: 'monthly',
    maxProjects: 4,
    maxOrdersPerMonth: 200,
    features: {
      autoPaymentMatch: true,
      kakaoNotification: 200,
      excelDownload: true,
      buyerCRM: false,
      aiAnnouncement: 0,
      projectCopy: true,
    },
  },
  pro: {
    name: '프로',
    price: 39900,
    billingType: 'monthly',
    maxProjects: 10,
    maxOrdersPerMonth: 600,
    badge: '추천',
    features: {
      autoPaymentMatch: true,
      kakaoNotification: 600,
      excelDownload: true,
      buyerCRM: true,
      aiAnnouncement: 10,
      projectCopy: true,
    },
  },
  biz: {
    name: '비즈',
    price: 79900,
    billingType: 'monthly',
    maxProjects: -1,
    maxOrdersPerMonth: 2000,
    features: {
      autoPaymentMatch: true,
      kakaoNotification: 2000,
      excelDownload: true,
      buyerCRM: true,
      aiAnnouncement: -1,
      projectCopy: true,
    },
  },
  pass_1: {
    name: '공구 1회권',
    price: 9900,
    billingType: 'pass',
    maxProjects: 1,
    maxOrdersPerMonth: 100,
    passTotal: 1,
    passOrderLimit: 100,
    features: {
      autoPaymentMatch: true,
      kakaoNotification: 100,
      excelDownload: true,
      buyerCRM: false,
      aiAnnouncement: 1,
      projectCopy: false,
    },
  },
  pass_3: {
    name: '공구 3회권',
    price: 24900,
    billingType: 'pass',
    maxProjects: 3,
    maxOrdersPerMonth: 100,
    passTotal: 3,
    passOrderLimit: 100,
    passExpiryDays: 90,
    badge: '인기',
    features: {
      autoPaymentMatch: true,
      kakaoNotification: 100,
      excelDownload: true,
      buyerCRM: false,
      aiAnnouncement: 1,
      projectCopy: true,
    },
  },
  pass_10: {
    name: '공구 10회권',
    price: 69900,
    billingType: 'pass',
    maxProjects: 10,
    maxOrdersPerMonth: 150,
    passTotal: 10,
    passOrderLimit: 150,
    passExpiryDays: 180,
    badge: '최고 가성비',
    features: {
      autoPaymentMatch: true,
      kakaoNotification: 150,
      excelDownload: true,
      buyerCRM: 'view',
      aiAnnouncement: 1,
      projectCopy: true,
    },
  },
};

export function hasFeature(
  planType: PlanType,
  feature: keyof PlanFeatures,
): boolean {
  const config = PLAN_CONFIG[planType];
  if (!config) return false;
  const val = config.features[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (val === 'view') return true;
  return false;
}
