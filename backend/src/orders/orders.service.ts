import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: bigint,
    params: { status?: string; search?: string; page?: number; limit?: number; projectId?: number },
  ) {
    const { status, search, page = 1, limit = 20, projectId } = params;
    const where: any = { userId };

    if (status && status !== 'all') where.status = status;
    if (projectId) where.projectId = BigInt(projectId);
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { orderNumber: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { product: true, option: true } },
          payment: true,
          shipment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(this.serializeOrder),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: bigint, userId: bigint) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: { include: { product: true, option: true } },
        payment: true,
        shipment: true,
      },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');
    return this.serializeOrder(order);
  }

  async createPublicOrder(slug: string, dto: CreateOrderDto) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
    });
    if (!project) throw new NotFoundException('주문폼을 찾을 수 없습니다.');

    const orderNumber = await this.generateOrderNumber();

    let totalPrice = 0;
    const itemsData: {
      productId: bigint;
      optionId: bigint | null;
      quantity: number;
      price: number;
    }[] = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: BigInt(item.productId) },
      });
      if (!product) continue;

      const itemPrice = product.price * item.quantity;
      totalPrice += itemPrice;
      itemsData.push({
        productId: BigInt(item.productId),
        optionId: item.optionId ? BigInt(item.optionId) : null,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId: project.userId,
        projectId: project.id,
        customerName: dto.customerName,
        phone: dto.phone,
        address: dto.address,
        totalPrice,
        depositName: dto.depositName,
        items: { create: itemsData },
        payment: {
          create: {
            amount: totalPrice,
            depositorName: dto.depositName,
          },
        },
        shipment: { create: {} },
      },
      include: {
        items: { include: { product: true, option: true } },
      },
    });

    return this.serializeOrder(order);
  }

  async updateStatus(id: bigint, userId: bigint, status: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async getDashboardStats(userId: bigint, projectId?: bigint) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orderWhere: any = { userId, createdAt: { gte: today }, status: { not: 'canceled' } };
    const paymentWhere: any = { order: { userId, status: { not: 'canceled' } }, status: 'pending' };
    const shipmentWhere: any = { order: { userId, status: { not: 'canceled' } }, status: 'pending' };
    const revenueWhere: any = { userId, status: { not: 'canceled' } };

    if (projectId) {
      orderWhere.projectId = projectId;
      paymentWhere.order.projectId = projectId;
      shipmentWhere.order.projectId = projectId;
      revenueWhere.projectId = projectId;
    }

    const [todayOrders, pendingPayments, pendingShipments, totalRevenue] =
      await Promise.all([
        this.prisma.order.count({ where: orderWhere }),
        this.prisma.payment.count({ where: paymentWhere }),
        this.prisma.shipment.count({ where: shipmentWhere }),
        this.prisma.order.aggregate({
          where: revenueWhere,
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

  async getRecentOrders(userId: bigint, projectId?: bigint) {
    const where: any = { userId };
    if (projectId) where.projectId = projectId;

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return orders.map(this.serializeOrder);
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `GM-${dateStr}-`;

    const lastOrder = await this.prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
    });

    let seq = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.orderNumber.split('-').pop() || '0');
      seq = lastSeq + 1;
    }

    return `${prefix}${seq.toString().padStart(4, '0')}`;
  }

  private serializeOrder(order: any) {
    return JSON.parse(
      JSON.stringify(order, (_, value) =>
        typeof value === 'bigint' ? Number(value) : value,
      ),
    );
  }
}
