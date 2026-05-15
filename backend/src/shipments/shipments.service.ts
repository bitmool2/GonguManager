import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShipmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: bigint, status?: string, projectId?: number) {
    const where: any = { order: { userId, status: { not: 'canceled' } } };
    if (status && status !== 'all') where.status = status;
    if (projectId) where.order.projectId = BigInt(projectId);

    const shipments = await this.prisma.shipment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            address: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map((s) =>
      JSON.parse(
        JSON.stringify(s, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
      ),
    );
  }

  async getSummary(userId: bigint, projectId?: number) {
    const base: any = { order: { userId, status: { not: 'canceled' } } };
    if (projectId) base.order.projectId = BigInt(projectId);

    const [pending, shipping, completed] = await Promise.all([
      this.prisma.shipment.count({ where: { ...base, status: 'pending' } }),
      this.prisma.shipment.count({ where: { ...base, status: 'shipping' } }),
      this.prisma.shipment.count({ where: { ...base, status: 'completed' } }),
    ]);
    return { pending, shipping, completed };
  }

  async registerTracking(
    id: bigint,
    userId: bigint,
    courier: string,
    trackingNumber: string,
  ) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, order: { userId } },
    });
    if (!shipment) throw new NotFoundException('배송 정보를 찾을 수 없습니다.');

    return this.prisma.shipment.update({
      where: { id },
      data: { courier, trackingNumber, status: 'shipping', shippedAt: new Date() },
    });
  }

  async updateStatus(id: bigint, userId: bigint, status: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, order: { userId } },
    });
    if (!shipment) throw new NotFoundException('배송 정보를 찾을 수 없습니다.');

    const data: any = { status };
    if (status === 'shipping' && !shipment.shippedAt) {
      data.shippedAt = new Date();
    }

    return this.prisma.shipment.update({ where: { id }, data });
  }
}
