import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: '전역 설정 조회 (계좌/배송정책)' })
  async getSettings(@CurrentUser() user: any) {
    return this.usersService.getSettings(BigInt(user.id));
  }

  @Put()
  @ApiOperation({ summary: '전역 설정 저장 (계좌/배송정책)' })
  async updateSettings(
    @Body()
    body: {
      bankName?: string;
      bankAccount?: string;
      bankHolder?: string;
      shippingDays?: number;
      exchangeDays?: number;
    },
    @CurrentUser() user: any,
  ) {
    return this.usersService.upsertSettings(BigInt(user.id), body);
  }
}
