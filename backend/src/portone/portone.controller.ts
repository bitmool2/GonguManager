import {
  Controller,
  Post,
  Body,
  HttpCode,
  Logger,
  BadRequestException,
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
}
