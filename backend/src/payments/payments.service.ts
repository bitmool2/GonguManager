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
    // 미입금 상태인 주문의 결제 목록 조회
    const pendingPayments = await this.prisma.payment.findMany({
      where: { order: { userId }, status: 'pending' },
      include: { order: true },
    });

    let matchedCount = 0;
    const unmatchedRecords: { depositorName: string; amount: number }[] = [];

    for (const record of records) {
      const match = pendingPayments.find(
        (p) =>
          p.order.depositName === record.depositorName &&
          p.amount === record.amount,
      );
      if (match) {
        await this.prisma.$transaction([
          this.prisma.payment.update({
            where: { id: match.id },
            data: { depositorName: record.depositorName, status: 'matched', paidAt: new Date() },
          }),
          this.prisma.order.update({
            where: { id: match.orderId },
            data: { status: 'paid' },
          }),
        ]);
        matchedCount++;
      } else {
        unmatchedRecords.push(record);
      }
    }

    // 미매칭 건은 UploadRecord에 저장 (중복 방지: 동일 입금자+금액+날짜가 없는 경우만)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const rec of unmatchedRecords) {
      const exists = await this.prisma.uploadRecord.findFirst({
        where: {
          userId,
          depositorName: rec.depositorName,
          amount: rec.amount,
          status: 'unmatched',
          uploadedAt: { gte: todayStart },
        },
      });
      if (!exists) {
        await this.prisma.uploadRecord.create({
          data: { userId, depositorName: rec.depositorName, amount: rec.amount },
        });
      }
    }

    return { total: records.length, matched: matchedCount, unmatched: unmatchedRecords.length };
  }

  async findUnmatchedRecords(userId: bigint) {
    const records = await this.prisma.uploadRecord.findMany({
      where: { userId, status: 'unmatched' },
      orderBy: { uploadedAt: 'desc' },
    });
    return records.map((r) =>
      JSON.parse(JSON.stringify(r, (_, v) => (typeof v === 'bigint' ? Number(v) : v))),
    );
  }

  async matchUploadRecord(recordId: bigint, userId: bigint, orderId: bigint) {
    const record = await this.prisma.uploadRecord.findFirst({
      where: { id: recordId, userId, status: 'unmatched' },
    });
    if (!record) throw new NotFoundException('업로드 레코드를 찾을 수 없습니다.');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true },
    });
    if (!order || !order.payment) throw new NotFoundException('주문을 찾을 수 없습니다.');

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: order.payment.id },
        data: { depositorName: record.depositorName, status: 'matched', paidAt: new Date() },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid' },
      }),
      this.prisma.uploadRecord.update({
        where: { id: recordId },
        data: { status: 'matched', matchedOrderId: orderId },
      }),
    ]);

    return { ok: true };
  }

  async deleteUploadRecord(recordId: bigint, userId: bigint) {
    const record = await this.prisma.uploadRecord.findFirst({
      where: { id: recordId, userId },
    });
    if (!record) throw new NotFoundException('업로드 레코드를 찾을 수 없습니다.');
    await this.prisma.uploadRecord.delete({ where: { id: recordId } });
    return { ok: true };
  }
}
