import { Injectable, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_INQUIRY_KEYWORDS = [
  '주문', '결제', '입금', '배송', '운송장', '택배', '상태', '확인',
  '언제', '됐나요', '됐어요', '완료', '처리', '현황',
];

/** 메시지가 주문/입금/배송 조회 의도인지 간단히 판단 */
function isOrderInquiry(message: string): boolean {
  return ORDER_INQUIRY_KEYWORDS.some((kw) => message.includes(kw));
}

/** 문자열에서 주문번호 패턴 추출 (GM-YYYYMMDD-NNNN 형태 등 하이픈 구분 영숫자 패턴) */
function extractOrderNumber(message: string): string | null {
  // GM-20260513-0009 처럼 "영문2~5자-8자리숫자-숫자" 패턴
  const match = message.match(/[A-Z]{2,5}-\d{8}-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

const STATUS_LABEL: Record<string, string> = {
  pending:   '주문 접수 (입금 대기)',
  paid:      '입금 완료',
  shipped:   '발송 완료',
  delivered: '배송 완료',
  cancelled: '주문 취소',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '입금 대기',
  paid:    '입금 완료',
};

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  ready:     '발송 준비',
  shipped:   '발송 완료',
  delivered: '배송 완료',
};

@Injectable()
export class ChatService {
  private anthropic: Anthropic;

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /** slug 직접 매칭 실패 시 prefix 제거 후 재시도 */
  private async resolveSlug(slug: string) {
    let project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project && slug.includes('_')) {
      const bare = slug.substring(slug.indexOf('_') + 1);
      project = await this.prisma.project.findUnique({ where: { slug: bare } });
    }
    return project;
  }

  /* ── 프로젝트 컨텍스트 빌드 ── */
  private async buildContext(projectSlug: string): Promise<string> {
    const project = await this.resolveSlug(projectSlug) as any;
    if (project) {
      // include 필요 항목 재조회
      const full = await this.prisma.project.findUnique({
        where: { id: project.id },
        include: {
          faqs:     true,
          products: {
            where: { status: 'active' },
            include: { options: true, detail: true },
          },
        },
      });
      if (!full) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
      Object.assign(project, full);
    }
    if (!project) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');

    const lines: string[] = [];

    lines.push(`=== 공구 프로젝트 정보 ===`);
    lines.push(`프로젝트명: ${project.name}`);
    if (project.description) lines.push(`설명: ${project.description}`);
    if (project.startDate)   lines.push(`시작일: ${project.startDate.toLocaleDateString('ko-KR')}`);
    if (project.endDate)     lines.push(`마감일: ${project.endDate.toLocaleDateString('ko-KR')}`);

    lines.push(`\n=== 배송·교환 정책 ===`);
    if (project.shippingDays) lines.push(`배송 소요일: 주문 후 약 ${project.shippingDays}일`);
    if (project.exchangeDays) lines.push(`교환·반품 기간: 수령 후 ${project.exchangeDays}일 이내`);

    lines.push(`\n=== 입금 안내 ===`);
    if (project.paymentMethod === 'personal' || project.paymentMethod === 'both') {
      if (project.bankName)    lines.push(`은행: ${project.bankName}`);
      if (project.bankAccount) lines.push(`계좌번호: ${project.bankAccount}`);
      if (project.bankHolder)  lines.push(`예금주: ${project.bankHolder}`);
    }
    if (project.paymentMethod === 'vbank' || project.paymentMethod === 'both') {
      lines.push(`가상계좌 발급 방식도 지원합니다.`);
    }

    lines.push(`\n=== 판매 상품 목록 ===`);
    for (const product of project.products) {
      lines.push(`\n[상품] ${product.name}`);
      lines.push(`가격: ${product.price.toLocaleString('ko-KR')}원`);
      lines.push(`재고: ${product.stock}개`);
      if (product.options.length > 0) {
        lines.push(`옵션:`);
        for (const opt of product.options) {
          lines.push(`  - ${opt.optionName} (재고: ${opt.stock}개)`);
        }
      }
      if (product.detail?.description) lines.push(`상품 설명:\n${product.detail.description}`);
      if (product.detail?.fileContent)  lines.push(`상품 상세 정보:\n${product.detail.fileContent}`);
    }

    if (project.faqs.length > 0) {
      lines.push(`\n=== 자주 묻는 질문 (FAQ) ===`);
      for (const faq of project.faqs) {
        lines.push(`Q: ${faq.question}`);
        lines.push(`A: ${faq.answer}\n`);
      }
    }

    return lines.join('\n');
  }

  /* ── 주문번호로 DB 조회 후 요약 텍스트 생성 ── */
  private async buildOrderContext(orderNumber: string, projectSlug: string): Promise<string | null> {
    const project = await this.resolveSlug(projectSlug);
    if (!project) return null;

    const order = await this.prisma.order.findFirst({
      where: { orderNumber, projectId: project.id },
      include: {
        items: {
          include: {
            product: true,
            option:  true,
          },
        },
        payment:  true,
        shipment: true,
      },
    });

    if (!order) return null;

    const lines: string[] = [];
    lines.push(`\n=== 주문 조회 결과 (주문번호: ${order.orderNumber}) ===`);
    lines.push(`주문자: ${order.customerName}`);
    lines.push(`주문 일시: ${order.createdAt.toLocaleString('ko-KR')}`);
    lines.push(`주문 상태: ${STATUS_LABEL[order.status] ?? order.status}`);
    lines.push(`총 결제 금액: ${order.totalPrice.toLocaleString('ko-KR')}원`);

    if (order.items.length > 0) {
      lines.push(`\n[구매 상품]`);
      for (const item of order.items) {
        const optLabel = item.option ? ` / ${item.option.optionName}` : '';
        lines.push(`  - ${item.product.name}${optLabel} × ${item.quantity}개 (${item.price.toLocaleString('ko-KR')}원)`);
      }
    }

    if (order.payment) {
      lines.push(`\n[입금 정보]`);
      lines.push(`입금 상태: ${PAYMENT_STATUS_LABEL[order.payment.status] ?? order.payment.status}`);
      if (order.payment.paidAt) lines.push(`입금 일시: ${order.payment.paidAt.toLocaleString('ko-KR')}`);
      if (order.payment.vbankNum) {
        lines.push(`가상계좌: ${order.payment.vbankName ?? ''} ${order.payment.vbankNum}`);
      }
    }

    if (order.shipment) {
      lines.push(`\n[배송 정보]`);
      lines.push(`배송 상태: ${SHIPMENT_STATUS_LABEL[order.shipment.status] ?? order.shipment.status}`);
      if ((order.shipment as any).trackingNumber) lines.push(`운송장 번호: ${(order.shipment as any).trackingNumber}`);
      if ((order.shipment as any).carrier)        lines.push(`택배사: ${(order.shipment as any).carrier}`);
    }

    return lines.join('\n');
  }

  /* ── 채팅 응답 생성 ── */
  async chat(
    projectSlug: string,
    visitorId: string,
    userMessage: string,
  ): Promise<{ reply: string; sessionId: number }> {
    const context = await this.buildContext(projectSlug);

    const project = await this.resolveSlug(projectSlug);
    if (!project) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');

    // 세션 조회 또는 생성
    let session = await this.prisma.chatSession.findFirst({
      where: { projectId: project.id, visitorId },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      session = await this.prisma.chatSession.create({
        data: { projectId: project.id, visitorId },
      });
    }

    // 최근 20개 메시지 히스토리
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // 주문번호 감지 → DB 조회
    let orderContext = '';
    const orderNumber = extractOrderNumber(userMessage);
    if (orderNumber) {
      const found = await this.buildOrderContext(orderNumber, projectSlug);
      if (found) {
        orderContext = found;
      } else {
        orderContext = `\n=== 주문 조회 결과 ===\n주문번호 "${orderNumber}"에 해당하는 주문을 찾을 수 없습니다.`;
      }
    }

    // 이전 대화에서 주문번호가 언급됐는지 확인 (히스토리 스캔)
    if (!orderNumber && isOrderInquiry(userMessage)) {
      for (const msg of [...history].reverse()) {
        const prevOrderNumber = extractOrderNumber(msg.content);
        if (prevOrderNumber) {
          const found = await this.buildOrderContext(prevOrderNumber, projectSlug);
          if (found) {
            orderContext = found;
          }
          break;
        }
      }
    }

    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    }));
    messages.push({ role: 'user', content: userMessage });

    const systemPrompt = `당신은 "${project.name}" 공구 상담 도우미입니다.
구매자의 질문에 친절하고 정확하게 답변해 주세요.
판매자가 직접 답변하는 것처럼 자연스럽게 응대하되, 과도한 약속이나 확인되지 않은 정보는 제공하지 마세요.
아래 프로젝트/상품 정보를 바탕으로 답변하세요. 모르는 내용은 "정확한 내용은 판매자에게 직접 문의해 주세요."라고 안내하세요.

[주문/입금/배송 조회 안내]
- 구매자가 주문 상태, 입금 여부, 배송 현황을 물어보면 먼저 주문번호(예: GM-20260513-0009)를 요청하세요.
- 주문번호가 제공되면 아래 "주문 조회 결과" 데이터를 바탕으로 정확한 정보를 안내하세요.
- 주문번호를 모를 경우 주문 시 받은 이메일이나 문자를 확인하도록 안내하세요.

${context}${orderContext}`;

    const response = await this.anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    });

    const reply = (response.content[0] as Anthropic.TextBlock).text;

    await this.prisma.chatMessage.createMany({
      data: [
        { sessionId: session.id, role: 'user',      content: userMessage },
        { sessionId: session.id, role: 'assistant', content: reply },
      ],
    });

    return {
      reply,
      sessionId: Number(session.id),
    };
  }

  /* ── 세션 히스토리 조회 ── */
  async getHistory(sessionId: bigint) {
    const messages = await this.prisma.chatMessage.findMany({
      where:   { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => ({
      ...m,
      id:        Number(m.id),
      sessionId: Number(m.sessionId),
    }));
  }
}
