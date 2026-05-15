import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: bigint) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async create(data: {
    email: string;
    passwordHash?: string;
    name: string;
    googleId?: string;
  }) {
    return this.prisma.user.create({ data });
  }

  async updateGoogleId(id: bigint, googleId: string) {
    return this.prisma.user.update({
      where: { id },
      data: { googleId },
    });
  }

  async getSettings(userId: bigint) {
    const setting = await this.prisma.userSetting.findUnique({ where: { userId } });
    if (!setting) return null;
    return JSON.parse(
      JSON.stringify(setting, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
    );
  }

  async upsertSettings(
    userId: bigint,
    data: {
      bankName?: string;
      bankAccount?: string;
      bankHolder?: string;
      shippingDays?: number;
      exchangeDays?: number;
    },
  ) {
    const { bankName, bankAccount, bankHolder, shippingDays, exchangeDays } = data;
    const result = await this.prisma.userSetting.upsert({
      where: { userId },
      update: { bankName, bankAccount, bankHolder, shippingDays, exchangeDays },
      create: { userId, bankName, bankAccount, bankHolder, shippingDays, exchangeDays },
    });
    return JSON.parse(
      JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
    );
  }
}
