import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ser = (data: any) =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));

@Injectable()
export class FaqsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: bigint, projectId?: bigint) {
    const faqs = await this.prisma.faq.findMany({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { id: 'asc' },
    });
    return faqs.map(ser);
  }

  async findBySlug(slug: string) {
    let project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project && slug.includes('_')) {
      const bare = slug.substring(slug.indexOf('_') + 1);
      project = await this.prisma.project.findUnique({ where: { slug: bare } });
    }
    if (!project) return [];
    const faqs = await this.prisma.faq.findMany({
      where: { projectId: project.id },
      orderBy: { id: 'asc' },
    });
    return faqs.map(ser);
  }

  async create(userId: bigint, question: string, answer: string, projectId?: bigint) {
    const faq = await this.prisma.faq.create({
      data: { userId, question, answer, ...(projectId ? { projectId } : {}) },
    });
    return ser(faq);
  }

  async update(id: bigint, userId: bigint, question: string, answer: string) {
    const faq = await this.prisma.faq.findFirst({ where: { id, userId } });
    if (!faq) throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    return ser(await this.prisma.faq.update({ where: { id }, data: { question, answer } }));
  }

  async delete(id: bigint, userId: bigint) {
    const faq = await this.prisma.faq.findFirst({ where: { id, userId } });
    if (!faq) throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    return this.prisma.faq.delete({ where: { id } });
  }
}
