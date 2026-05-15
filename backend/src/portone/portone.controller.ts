import {
  Controller,
  Post,
  Body,
  HttpCode,
  Logger,
  BadRequestException,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PortoneService } from './portone.service';
import { PrismaService } from '../prisma/prisma.service';

interface WebhookBody {
  imp_uid: string;
  merchant_uid: string; // = orderNumber
  status: string;       // ready | paid | cancelled | failed
}

@ApiTags('Portone')
@Controller('portone')
export class PortoneController {
  private readonly logger = new Logger(PortoneController.name);

  constructor(
    private portoneService: PortoneService,
    private prisma: PrismaService,
  ) {}

  /**
   * PortOne → 서버 webhook
   * status: ready  = 가상계좌 발급 완료
   *         paid   = 입금 완료
   *         cancelled / failed
   */
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: '포트원 결제 webhook' })
  async webhook(@Body() body: WebhookBody) {
    this.logger.log(`Webhook: ${JSON.stringify(body)}`);

    const { imp_uid, merchant_uid, status } = body;
    if (!imp_uid || !merchant_uid) throw new BadRequestException('필수 파라미터 누락');

    // 주문 조회 (merchant_uid = orderNumber)
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: merchant_uid },
      include: { payment: true },
    });
    if (!order) {
      this.logger.warn(`Order not found: ${merchant_uid}`);
      return { ok: false };
    }

    try {
      // 포트원 결제 정보 조회
      const portonePayment = await this.portoneService.getPayment(imp_uid);

      if (status === 'ready') {
        // 가상계좌 발급 완료 → 계좌 정보 저장
        await this.prisma.payment.update({
          where: { orderId: order.id },
          data: {
            impUid: imp_uid,
            vbankNum: portonePayment.vbank_num,
            vbankName: portonePayment.vbank_name,
            vbankHolder: portonePayment.vbank_holder,
            vbankExpiry: portonePayment.vbank_date
              ? new Date(portonePayment.vbank_date * 1000)
              : null,
          },
        });
        this.logger.log(`가상계좌 발급: ${merchant_uid} → ${portonePayment.vbank_num}`);
      } else if (status === 'paid') {
        // 입금 확인 → 금액 검증 후 상태 변경
        if (portonePayment.amount !== order.totalPrice) {
          this.logger.error(
            `금액 불일치: order=${order.totalPrice} portone=${portonePayment.amount}`,
          );
          return { ok: false, reason: 'amount_mismatch' };
        }
        await Promise.all([
          this.prisma.order.update({
            where: { id: order.id },
            data: { status: 'paid' },
          }),
          this.prisma.payment.update({
            where: { orderId: order.id },
            data: {
              impUid: imp_uid,
              status: 'paid',
              paidAt: new Date(),
              depositorName: portonePayment.buyer_name,
            },
          }),
        ]);
        this.logger.log(`입금 완료 처리: ${merchant_uid}`);
      } else if (status === 'cancelled' || status === 'failed') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'canceled' },
        });
        this.logger.log(`주문 취소/실패: ${merchant_uid} (${status})`);
      }
    } catch (err: any) {
      this.logger.error(`Webhook 처리 오류: ${err.message}`);
    }

    return { ok: true };
  }

  /**
   * 가상계좌 발급 후 프론트에서 imp_uid 전달 → 계좌 정보 저장
   */
  @Post('vbank-issued')
  @HttpCode(200)
  @ApiOperation({ summary: '가상계좌 발급 정보 저장 (프론트→백엔드)' })
  async saveVbankInfo(
    @Body()
    body: {
      orderNumber: string;
      imp_uid: string;
      vbank_num: string;
      vbank_name: string;
      vbank_holder: string;
      vbank_date: number;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: body.orderNumber },
    });
    if (!order) throw new BadRequestException('주문을 찾을 수 없습니다.');

    await this.prisma.payment.update({
      where: { orderId: order.id },
      data: {
        impUid: body.imp_uid,
        vbankNum: body.vbank_num,
        vbankName: body.vbank_name,
        vbankHolder: body.vbank_holder,
        vbankExpiry: body.vbank_date ? new Date(body.vbank_date * 1000) : null,
      },
    });

    return { ok: true };
  }

  /* ══════════════════════════════════════════════
   * 로컬 개발 전용 테스트 엔드포인트
   * NODE_ENV=production 에서는 400 응답
   * ══════════════════════════════════════════════ */

  /** 1단계: 가상계좌 발급 시뮬레이션 */
  @Post('test/simulate-vbank')
  @HttpCode(200)
  @ApiOperation({ summary: '[테스트] 가상계좌 발급 시뮬레이션' })
  async simulateVbank(
    @Body() body: { orderNumber: string; depositorName?: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('테스트 엔드포인트는 production에서 사용 불가');
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNumber: body.orderNumber },
      include: { payment: true },
    });
    if (!order) throw new BadRequestException(`주문을 찾을 수 없습니다: ${body.orderNumber}`);

    const fakeImpUid = `test_imp_${Date.now()}`;
    const fakeVbankNum = `110${Math.floor(Math.random() * 9000000 + 1000000)}`;
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간 후

    await this.prisma.payment.update({
      where: { orderId: order.id },
      data: {
        impUid: fakeImpUid,
        vbankNum: fakeVbankNum,
        vbankName: '테스트은행',
        vbankHolder: '공구매니저(테스트)',
        vbankExpiry: expiry,
      },
    });

    this.logger.log(`[TEST] 가상계좌 발급 시뮬레이션: ${body.orderNumber} → ${fakeVbankNum}`);

    return {
      ok: true,
      imp_uid: fakeImpUid,
      vbank_num: fakeVbankNum,
      vbank_name: '테스트은행',
      vbank_holder: '공구매니저(테스트)',
      vbank_expiry: expiry,
      message: '가상계좌 발급 시뮬레이션 완료. 다음 단계: POST /portone/test/simulate-paid',
    };
  }

  /** 2단계: 입금 완료 시뮬레이션 */
  @Post('test/simulate-paid')
  @HttpCode(200)
  @ApiOperation({ summary: '[테스트] 입금 완료 시뮬레이션' })
  async simulatePaid(
    @Body() body: { orderNumber: string; depositorName?: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('테스트 엔드포인트는 production에서 사용 불가');
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNumber: body.orderNumber },
      include: { payment: true },
    });
    if (!order) throw new BadRequestException(`주문을 찾을 수 없습니다: ${body.orderNumber}`);
    if (!order.payment?.impUid) {
      throw new BadRequestException(
        '가상계좌 발급 기록이 없습니다. 먼저 POST /portone/test/simulate-vbank 를 호출하세요.',
      );
    }

    const depositorName = body.depositorName ?? '홍길동(테스트)';

    await Promise.all([
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'paid' },
      }),
      this.prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: 'matched',
          paidAt: new Date(),
          depositorName,
        },
      }),
    ]);

    this.logger.log(`[TEST] 입금 완료 시뮬레이션: ${body.orderNumber} 입금자=${depositorName}`);

    return {
      ok: true,
      orderNumber: body.orderNumber,
      orderStatus: 'paid',
      paymentStatus: 'matched',
      depositorName,
      paidAt: new Date(),
      message: '입금 완료 시뮬레이션 완료. 주문 상태가 paid로 변경되었습니다.',
    };
  }

  /** 현재 주문 + 결제 상태 조회 (테스트 확인용) */
  @Get('test/order-status')
  @ApiOperation({ summary: '[테스트] 주문·결제 상태 조회' })
  async testOrderStatus(@Query('orderNumber') orderNumber: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('테스트 엔드포인트는 production에서 사용 불가');
    }
    if (!orderNumber) throw new BadRequestException('orderNumber 쿼리 파라미터 필요');

    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { payment: true, items: true },
    });
    if (!order) throw new BadRequestException(`주문을 찾을 수 없습니다: ${orderNumber}`);

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      totalPrice: order.totalPrice,
      payment: order.payment
        ? {
            status: order.payment.status,
            impUid: order.payment.impUid,
            vbankNum: order.payment.vbankNum,
            vbankName: order.payment.vbankName,
            vbankHolder: order.payment.vbankHolder,
            vbankExpiry: order.payment.vbankExpiry,
            depositorName: order.payment.depositorName,
            paidAt: order.payment.paidAt,
          }
        : null,
      items: order.items,
    };
  }
}
