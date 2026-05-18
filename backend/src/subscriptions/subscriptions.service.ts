import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_CONFIG, PlanType } from './plan.config';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  /** 신규 가입 시 free 구독 생성 */
  async createFree(userId: bigint) {
    return this.prisma.subscription.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        planType: 'free',
        status: 'active',
        ordersResetAt: new Date(),
      },
    });
  }

  /** 내 구독 정보 조회 */
  async findMySubscription(userId: bigint) {
    let sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!sub) {
      sub = await this.createFree(userId);
    }
    return this.serialize(sub);
  }

  /** 사용량 조회 (프로젝트 수, 이번 달 주문 수) */
  async getUsage(userId: bigint) {
    const sub = await this.findMySubscription(userId);
    const plan = PLAN_CONFIG[sub.planType as PlanType];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [projectCount, orderCount] = await Promise.all([
      this.prisma.project.count({ where: { userId, status: { not: 'deleted' } } }),
      this.prisma.order.count({
        where: {
          userId,
          status: { not: 'canceled' },
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      subscription: sub,
      plan,
      usage: {
        projects: { used: projectCount, limit: plan.maxProjects },
        orders: {
          used: orderCount,
          limit:
            plan.billingType === 'pass'
              ? plan.passOrderLimit ?? plan.maxOrdersPerMonth
              : plan.maxOrdersPerMonth,
        },
      },
    };
  }

  /** 플랜 업그레이드 (결제 완료 후 호출) */
  async upgrade(
    userId: bigint,
    planType: PlanType,
    impUid: string,
  ) {
    const plan = PLAN_CONFIG[planType];
    if (!plan) throw new NotFoundException('존재하지 않는 플랜입니다.');

    const now = new Date();
    let endDate: Date | null = null;
    let passTotal: number | null = null;
    let passExpiry: Date | null = null;

    if (plan.billingType === 'monthly') {
      // 1개월 후 만료
      endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan.billingType === 'pass') {
      passTotal = plan.passTotal ?? 1;
      if (plan.passExpiryDays) {
        passExpiry = new Date(now);
        passExpiry.setDate(passExpiry.getDate() + plan.passExpiryDays);
      }
    }

    const sub = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planType,
        status: 'active',
        startDate: now,
        endDate,
        passTotal,
        passUsed: 0,
        passExpiry,
        ordersUsed: 0,
        ordersResetAt: now,
        impUid,
      },
      create: {
        userId,
        planType,
        status: 'active',
        startDate: now,
        endDate,
        passTotal,
        passUsed: 0,
        passExpiry,
        ordersUsed: 0,
        ordersResetAt: now,
        impUid,
      },
    });

    return this.serialize(sub);
  }

  /** 프로젝트 생성 전 플랜 한도 검증 */
  async checkProjectLimit(userId: bigint) {
    const { subscription, plan } = await this.getUsage(userId);

    if (plan.maxProjects === -1) return; // 무제한

    const count = await this.prisma.project.count({
      where: { userId, status: { not: 'deleted' } },
    });

    if (count >= plan.maxProjects) {
      throw new ForbiddenException(
        `현재 플랜(${plan.name})에서는 프로젝트를 최대 ${plan.maxProjects}개까지 만들 수 있습니다. 플랜을 업그레이드해주세요.`,
      );
    }

    // pass형 만료/소진 체크
    if (plan.billingType === 'pass') {
      if (
        subscription.passExpiry &&
        new Date(subscription.passExpiry) < new Date()
      ) {
        throw new ForbiddenException('이용권 유효기간이 만료되었습니다.');
      }
      if (
        subscription.passTotal !== null &&
        subscription.passUsed >= subscription.passTotal
      ) {
        throw new ForbiddenException('이용권 횟수를 모두 사용했습니다.');
      }
    }
  }

  /** 주문 생성 전 플랜 한도 검증 */
  async checkOrderLimit(userId: bigint) {
    const { plan } = await this.getUsage(userId);
    const limit =
      plan.billingType === 'pass'
        ? plan.passOrderLimit ?? plan.maxOrdersPerMonth
        : plan.maxOrdersPerMonth;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const count = await this.prisma.order.count({
      where: {
        userId,
        status: { not: 'canceled' },
        createdAt: { gte: monthStart },
      },
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `현재 플랜(${plan.name})의 이번 달 주문 한도(${limit}건)에 도달했습니다.`,
      );
    }
  }

  /** pass형: 프로젝트 생성 시 회수 차감 */
  async consumePass(userId: bigint) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return;
    const plan = PLAN_CONFIG[sub.planType as PlanType];
    if (plan?.billingType !== 'pass') return;

    await this.prisma.subscription.update({
      where: { userId },
      data: { passUsed: { increment: 1 } },
    });
  }

  /** 플랜 정보 전체 목록 반환 */
  getAllPlans() {
    return Object.entries(PLAN_CONFIG).map(([key, config]) => ({
      planType: key,
      ...config,
    }));
  }

  private serialize(data: any) {
    return JSON.parse(
      JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
    );
  }
}
