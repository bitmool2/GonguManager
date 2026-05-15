import { Controller, Post, Get, Body, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post(':slug')
  @HttpCode(200)
  @ApiOperation({ summary: '공개 AI 상담 (구매자용)' })
  async chat(
    @Param('slug') slug: string,
    @Body() body: { visitorId: string; message: string },
  ) {
    return this.chatService.chat(slug, body.visitorId, body.message);
  }

  @Get(':slug/history')
  @ApiOperation({ summary: '채팅 히스토리 조회' })
  async getHistory(
    @Param('slug') slug: string,
    @Query('sessionId') sessionId: string,
  ) {
    if (!sessionId) return [];
    return this.chatService.getHistory(BigInt(sessionId));
  }
}
