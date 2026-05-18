import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /* ── 대시보드 통계 ── */
  async getDashboardStats() {
    const [
      totalUsers,
      totalProjects,
      totalOrders,
      totalRevenue,
      recentUsers,
      planCounts,
      orderStatusCounts,
      monthlyOrders,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.project.count(),
      this.prisma.order.count(),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),

      // 최근 7일 신규 가입
      this.prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),

      // 플랜별 사용자 수
      this.prisma.subscription.groupBy({
        by: ['planType'],
        _count: { _all: true },
      }),

      // 주문 상태별 건수
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),

      // 최근 12개월 월별 주문 건수 (raw)
      this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
        FROM orders
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month ORDER BY month ASC
      `,
    ]);

    return {
      totalUsers,
      totalProjects,
      totalOrders,
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
      recentUsers,
      planCounts: planCounts.map((p) => ({ planType: p.planType, count: p._count._all })),
      orderStatusCounts: orderStatusCounts.map((s) => ({ status: s.status, count: s._count._all })),
      monthlyOrders: monthlyOrders.map((r) => ({ month: r.month, count: Number(r.count) })),
    };
  }

  /* ── 사용자 목록 (구독 포함) ── */
  async getUsers(page = 1, limit = 20, search = '') {
    const skip = (page - 1) * limit;
    const where = search
      ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          _count: { select: { projects: true, orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        id: Number(u.id),
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        projectCount: u._count.projects,
        orderCount: u._count.orders,
        subscription: u.subscription
          ? {
              planType: u.subscription.planType,
              status: u.subscription.status,
              startDate: u.subscription.startDate,
              endDate: u.subscription.endDate,
              passTotal: u.subscription.passTotal,
              passUsed: u.subscription.passUsed,
              passExpiry: u.subscription.passExpiry,
              ordersUsed: u.subscription.ordersUsed,
            }
          : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ── 주문 목록 ── */
  async getOrders(page = 1, limit = 30, search = '', status = '') {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          project: { select: { name: true } },
          payment: { select: { status: true, amount: true, paidAt: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((o) => ({
        id: Number(o.id),
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        phone: o.phone,
        totalPrice: o.totalPrice,
        status: o.status,
        createdAt: o.createdAt,
        itemCount: o._count.items,
        user: o.user,
        project: o.project?.name ?? '-',
        payment: o.payment ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ── 프로젝트 목록 ── */
  async getProjects(page = 1, limit = 30, search = '') {
    const skip = (page - 1) * limit;
    const where = search ? { name: { contains: search } } : {};

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          _count: { select: { orders: true, products: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map((p) => ({
        id: Number(p.id),
        name: p.name,
        status: p.status,
        slug: p.slug,
        startDate: p.startDate,
        endDate: p.endDate,
        createdAt: p.createdAt,
        user: p.user,
        orderCount: p._count.orders,
        productCount: p._count.products,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ── 결제 목록 ── */
  async getPayments(page = 1, limit = 30, status = '') {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              user: { select: { email: true } },
              project: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => ({
        id: Number(p.id),
        amount: p.amount,
        status: p.status,
        paidAt: p.paidAt,
        depositorName: p.depositorName,
        impUid: p.impUid,
        vbankNum: p.vbankNum,
        vbankName: p.vbankName,
        createdAt: p.createdAt,
        order: p.order,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ── 배송 목록 ── */
  async getShipments(page = 1, limit = 30, status = '') {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              addrBase: true,
              addrDetail: true,
              user: { select: { email: true } },
            },
          },
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      data: shipments.map((s) => ({
        id: Number(s.id),
        status: s.status,
        courier: s.courier,
        trackingNumber: s.trackingNumber,
        shippedAt: s.shippedAt,
        createdAt: s.createdAt,
        order: s.order,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ── 사용자 역할 변경 ── */
  async setUserRole(userId: number, role: string) {
    const user = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { role },
    });
    return { id: Number(user.id), email: user.email, role: user.role };
  }
}
