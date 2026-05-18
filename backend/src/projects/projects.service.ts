import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async findAll(userId: bigint) {
    const [projects, canceledCounts] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId },
        include: {
          _count: { select: { orders: true, products: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.groupBy({
        by: ['projectId'],
        where: { userId, status: 'canceled' },
        _count: { id: true },
      }),
    ]);

    const canceledMap = new Map(
      canceledCounts.map((c) => [Number(c.projectId), c._count.id]),
    );

    return projects.map((p) => {
      const totalOrders = p._count.orders;
      const canceledOrders = canceledMap.get(Number(p.id)) || 0;
      return this.serialize({
        ...p,
        _count: {
          ...p._count,
          activeOrders: totalOrders - canceledOrders,
          canceledOrders,
        },
      });
    });
  }

  async findById(id: bigint, userId: bigint) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { orders: true, products: true } },
      },
    });
    if (!project) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    return this.serialize(project);
  }

  async findBySlug(slug: string) {
    // 직접 매칭 시도
    let project = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        products: {
          where: { status: 'active' },
          include: { options: true },
        },
      },
    });

    // emailPrefix_slug 형태로 요청됐을 때 prefix 제거 후 재시도
    if (!project && slug.includes('_')) {
      const slugWithoutPrefix = slug.substring(slug.indexOf('_') + 1);
      project = await this.prisma.project.findUnique({
        where: { slug: slugWithoutPrefix },
        include: {
          products: {
            where: { status: 'active' },
            include: { options: true },
          },
        },
      });
    }

    if (!project) throw new NotFoundException('주문폼을 찾을 수 없습니다.');
    return this.serialize(project);
  }

  async create(
    userId: bigint,
    data: {
      name: string;
      description?: string;
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
    },
    userEmail?: string,
  ) {
    // 플랜 프로젝트 한도 검증
    await this.subscriptionsService.checkProjectLimit(userId);

    // slug 생성: emailPrefix_userInputSlug 형태로 조합
    let finalSlug: string | null = null;
    if (data.slug) {
      const emailPrefix = userEmail
        ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '')
        : '';
      finalSlug = emailPrefix ? `${emailPrefix}_${data.slug}` : data.slug;

      const existing = await this.prisma.project.findUnique({
        where: { slug: finalSlug },
      });
      if (existing) throw new ConflictException('이미 사용 중인 슬러그입니다.');
    }

    return this.serialize(
      await this.prisma.project.create({
        data: {
          userId,
          name: data.name,
          description: data.description,
          slug: finalSlug,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          bankName: data.bankName,
          bankAccount: data.bankAccount,
          bankHolder: data.bankHolder,
          shippingDays: data.shippingDays,
          exchangeDays: data.exchangeDays,
          paymentMethod: data.paymentMethod ?? 'personal',
          impKey: data.impKey,
        },
        include: { _count: { select: { orders: true, products: true } } },
      }),
    );
  }

  async update(
    id: bigint,
    userId: bigint,
    data: {
      name?: string;
      description?: string;
      status?: string;
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
    },
  ) {
    await this.findById(id, userId);

    if (data.slug) {
      const existing = await this.prisma.project.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (existing) throw new ConflictException('이미 사용 중인 슬러그입니다.');
    }

    return this.serialize(
      await this.prisma.project.update({
        where: { id },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
        include: { _count: { select: { orders: true, products: true } } },
      }),
    );
  }

  async delete(id: bigint, userId: bigint) {
    await this.findById(id, userId);
    return this.prisma.project.delete({ where: { id } });
  }

  async getStats(id: bigint, userId: bigint) {
    await this.findById(id, userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, pendingPayments, pendingShipments, totalRevenue] =
      await Promise.all([
        this.prisma.order.count({
          where: { projectId: id, createdAt: { gte: today }, status: { not: 'canceled' } },
        }),
        this.prisma.payment.count({
          where: { order: { projectId: id, status: { not: 'canceled' } }, status: 'pending' },
        }),
        this.prisma.shipment.count({
          where: { order: { projectId: id, status: { not: 'canceled' } }, status: 'pending' },
        }),
        this.prisma.order.aggregate({
          where: { projectId: id, status: { not: 'canceled' } },
          _sum: { totalPrice: true },
        }),
      ]);

    return {
      todayOrders,
      pendingPayments,
      pendingShipments,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
    };
  }

  private serialize(data: any) {
    return JSON.parse(
      JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
    );
  }
}
