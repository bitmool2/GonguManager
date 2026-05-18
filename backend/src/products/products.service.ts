import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const serialize = (data: any) =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: bigint, projectId?: bigint) {
    const products = await this.prisma.product.findMany({
      where: { userId, ...(projectId ? { projectId } : {}) },
      include: { options: true, detail: true },
      orderBy: { createdAt: 'desc' },
    });
    return serialize(products);
  }

  async findById(id: bigint, userId: bigint) {
    const product = await this.prisma.product.findFirst({
      where: { id, userId },
      include: { options: true },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다.');
    return serialize(product);
  }

  async findBySlug(slug: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project) throw new NotFoundException('주문폼을 찾을 수 없습니다.');
    const products = await this.prisma.product.findMany({
      where: { projectId: project.id, status: 'active' },
      include: { options: true },
    });
    return serialize(products);
  }

  async create(
    userId: bigint,
    data: {
      name: string;
      price: number;
      stock: number;
      projectId?: bigint | null;
      options?: { optionName: string; stock: number }[];
    },
  ) {
    const product = await this.prisma.product.create({
      data: {
        userId,
        name: data.name,
        price: data.price,
        stock: data.stock,
        projectId: data.projectId ?? null,
        options: data.options ? { create: data.options } : undefined,
      },
      include: { options: true },
    });
    return serialize(product);
  }

  async update(
    id: bigint,
    userId: bigint,
    data: { name?: string; price?: number; stock?: number; status?: string },
  ) {
    await this.findById(id, userId);
    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: { options: true },
    });
    return serialize(product);
  }

  async delete(id: bigint, userId: bigint) {
    await this.findById(id, userId);
    return this.prisma.product.delete({ where: { id } });
  }

  /* ── 옵션 관리 ── */

  async addOption(productId: bigint, userId: bigint, optionName: string, stock: number) {
    await this.findById(productId, userId);
    const count = await this.prisma.productOption.count({ where: { productId } });
    if (count >= 3) throw new BadRequestException('옵션은 최대 3개까지만 추가할 수 있습니다.');
    const option = await this.prisma.productOption.create({
      data: { productId, optionName, stock },
    });
    return serialize(option);
  }

  async updateOption(optionId: bigint, userId: bigint, optionName: string, stock: number) {
    const option = await this.prisma.productOption.findFirst({
      where: { id: optionId, product: { userId } },
    });
    if (!option) throw new NotFoundException('옵션을 찾을 수 없습니다.');
    const updated = await this.prisma.productOption.update({
      where: { id: optionId },
      data: { optionName, stock },
    });
    return serialize(updated);
  }

  async deleteOption(optionId: bigint, userId: bigint) {
    const option = await this.prisma.productOption.findFirst({
      where: { id: optionId, product: { userId } },
    });
    if (!option) throw new NotFoundException('옵션을 찾을 수 없습니다.');
    return this.prisma.productOption.delete({ where: { id: optionId } });
  }

  async upsertDetail(
    productId: bigint,
    userId: bigint,
    data: { description?: string; fileName?: string; fileContent?: string },
  ) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, userId } });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다.');

    const result = await this.prisma.productDetail.upsert({
      where:  { productId },
      create: { productId, ...data },
      update: data,
    });
    return serialize(result);
  }

  async getDetail(productId: bigint, userId: bigint) {
    const product = await this.prisma.product.findFirst({
      where:   { id: productId, userId },
      include: { detail: true },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다.');
    return serialize(product.detail);
  }

  async deleteDetail(productId: bigint, userId: bigint) {
    const detail = await this.prisma.productDetail.findFirst({
      where: { productId, product: { userId } },
    });
    if (!detail) throw new NotFoundException('상세 정보가 없습니다.');
    await this.prisma.productDetail.delete({ where: { id: detail.id } });
    return { ok: true };
  }
}

