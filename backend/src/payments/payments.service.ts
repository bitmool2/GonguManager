import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: bigint, status?: string, projectId?: number) {
    const where: any = { order: { userId, status: { not: 'canceled' } } };
    if (status && status !== 'all') where.status = status;
    if (projectId) where.order.projectId = BigInt(projectId);

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            depositName: true,
            totalPrice: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) =>
      JSON.parse(
        JSON.stringify(p, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
      ),
    );
  }

  async getSummary(userId: bigint, projectId?: number) {
    const base: any = { order: { userId, status: { not: 'canceled' } } };
    if (projectId) base.order.projectId = BigInt(projectId);

    const [matched, pending, mismatch] = await Promise.all([
      this.prisma.payment.count({ where: { ...base, status: 'matched' } }),
      this.prisma.payment.count({ where: { ...base, status: 'pending' } }),
      this.prisma.payment.count({ where: { ...base, status: 'mismatch' } }),
    ]);
    return { matched, pending, mismatch };
  }

  async confirmPayment(id: bigint, userId: bigint) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, order: { userId } },
    });
    if (!payment) throw new NotFoundException('입금 정보를 찾을 수 없습니다.');

    return this.prisma.payment.update({
      where: { id },
      data: { status: 'matched', paidAt: new Date() },
    });
  }

  async manualMatch(id: bigint, userId: bigint, depositorName: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, order: { userId } },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('입금 정보를 찾을 수 없습니다.');

    const status =
      depositorName === payment.order.depositName ? 'matched' : 'mismatch';

    return this.prisma.payment.update({
      where: { id },
      data: { depositorName, status, paidAt: status === 'matched' ? new Date() : null },
    });
  }

  async uploadPayments(userId: bigint, records: { depositorName: string; amount: number }[]) {
    const pendingPayments = await this.prisma.payment.findMany({
      where: { order: { userId }, status: 'pending' },
      include: { order: true },
    });

    let matchedCount = 0;
    for (const record of records) {
      const match = pendingPayments.find(
        (p) =>
          p.order.depositName === record.depositorName &&
          p.amount === record.amount,
      );
      if (match) {
        await this.prisma.payment.update({
          where: { id: match.id },
          data: {
            depositorName: record.depositorName,
            status: 'matched',
            paidAt: new Date(),
          },
        });
        matchedCount++;
      }
    }
    return { total: records.length, matched: matchedCount };
  }
}
