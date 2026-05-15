import { Injectable, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  private anthropic: Anthropic;

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  /* ── 프로젝트 컨텍스트 빌드 ── */
  private async buildContext(projectSlug: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        faqs:     true,
        products: {
          where: { status: 'active' },
          include: { options: true, detail: true },
        },
      },
    });
    if (!project) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');

    const lines: string[] = [];

    // 프로젝트 기본 정보
    lines.push(`=== 공구 프로젝트 정보 ===`);
    lines.push(`프로젝트명: ${project.name}`);
    if (project.description) lines.push(`설명: ${project.description}`);
    if (project.startDate)   lines.push(`시작일: ${project.startDate.toLocaleDateString('ko-KR')}`);
    if (project.endDate)     lines.push(`마감일: ${project.endDate.toLocaleDateString('ko-KR')}`);

    // 배송 정책
    lines.push(`\n=== 배송·교환 정책 ===`);
    if (project.shippingDays) lines.push(`배송 소요일: 주문 후 약 ${project.shippingDays}일`);
    if (project.exchangeDays) lines.push(`교환·반품 기간: 수령 후 ${project.exchangeDays}일 이내`);

    // 입금 안내
    lines.push(`\n=== 입금 안내 ===`);
    if (project.paymentMethod === 'personal' || project.paymentMethod === 'both') {
      if (project.bankName)    lines.push(`은행: ${project.bankName}`);
      if (project.bankAccount) lines.push(`계좌번호: ${project.bankAccount}`);
      if (project.bankHolder)  lines.push(`예금주: ${project.bankHolder}`);
    }
    if (project.paymentMethod === 'vbank' || project.paymentMethod === 'both') {
      lines.push(`가상계좌 발급 방식도 지원합니다.`);
    }

    // 상품 정보
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

      if (product.detail?.description) {
        lines.push(`상품 설명:\n${product.detail.description}`);
      }
      if (product.detail?.fileContent) {
        lines.push(`상품 상세 정보:\n${product.detail.fileContent}`);
      }
    }

    // FAQ
    if (project.faqs.length > 0) {
      lines.push(`\n=== 자주 묻는 질문 (FAQ) ===`);
      for (const faq of project.faqs) {
        lines.push(`Q: ${faq.question}`);
        lines.push(`A: ${faq.answer}\n`);
      }
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

    const project = await this.prisma.project.findUnique({ where: { slug: projectSlug } });
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

    // 최근 10턴 히스토리 조회
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Claude 메시지 구성
    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    }));
    messages.push({ role: 'user', content: userMessage });

    const systemPrompt = `당신은 "${project.name}" 공구 상담 도우미입니다.
구매자의 질문에 친절하고 정확하게 답변해 주세요.
판매자가 직접 답변하는 것처럼 자연스럽게 응대하되, 과도한 약속이나 확인되지 않은 정보는 제공하지 마세요.
아래 프로젝트/상품 정보를 바탕으로 답변하세요. 모르는 내용은 "정확한 내용은 판매자에게 직접 문의해 주세요."라고 안내하세요.

${context}`;

    const response = await this.anthropic.messages.create({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    });

    const reply = (response.content[0] as Anthropic.TextBlock).text;

    // 메시지 저장
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
