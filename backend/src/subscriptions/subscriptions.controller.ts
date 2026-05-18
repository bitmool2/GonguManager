import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { PlanType } from './plan.config';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  /** 플랜 목록 (공개) */
  @Get('plans')
  @ApiOperation({ summary: '플랜 목록 조회' })
  getPlans() {
    return this.subscriptionsService.getAllPlans();
  }

  /** 내 구독 정보 */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 구독 정보 조회' })
  async getMy(@CurrentUser() user: any) {
    return this.subscriptionsService.findMySubscription(BigInt(user.id));
  }

  /** 사용량 포함 내 구독 정보 */
  @Get('my/usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용량 포함 구독 정보' })
  async getUsage(@CurrentUser() user: any) {
    return this.subscriptionsService.getUsage(BigInt(user.id));
  }

  /** 플랜 업그레이드 (결제 완료 후 호출) */
  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '플랜 업그레이드' })
  async upgrade(
    @Body() body: { planType: PlanType; impUid: string },
    @CurrentUser() user: any,
  ) {
    return this.subscriptionsService.upgrade(
      BigInt(user.id),
      body.planType,
      body.impUid,
    );
  }

  /** 개발용 결제 우회 (NODE_ENV=production 에서는 비활성화) */
  @Post('dev/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[개발용] 결제 없이 플랜 즉시 적용' })
  async devApply(
    @Body() body: { planType: PlanType },
    @CurrentUser() user: any,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('프로덕션 환경에서는 사용할 수 없습니다.');
    }
    return this.subscriptionsService.upgrade(
      BigInt(user.id),
      body.planType,
      `dev_test_${Date.now()}`,
    );
  }
}
