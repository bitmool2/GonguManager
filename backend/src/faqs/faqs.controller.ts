import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FaqsService } from './faqs.service';

@ApiTags('FAQs')
@Controller('faqs')
export class FaqsController {
  constructor(private faqsService: FaqsService) {}

  /** 공개 FAQ 조회 (주문서용, 인증 불필요) */
  @Get('public/:slug')
  @ApiOperation({ summary: '공개 FAQ 조회 (slug)' })
  async findPublic(@Param('slug') slug: string) {
    return this.faqsService.findBySlug(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'FAQ 목록 조회 (projectId로 필터)' })
  async findAll(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.faqsService.findAll(
      BigInt(user.id),
      projectId ? BigInt(projectId) : undefined,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'FAQ 생성' })
  async create(
    @Body() body: { question: string; answer: string; projectId?: number },
    @CurrentUser() user: any,
  ) {
    return this.faqsService.create(
      BigInt(user.id),
      body.question,
      body.answer,
      body.projectId ? BigInt(body.projectId) : undefined,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'FAQ 수정' })
  async update(
    @Param('id') id: string,
    @Body() body: { question: string; answer: string },
    @CurrentUser() user: any,
  ) {
    return this.faqsService.update(BigInt(id), BigInt(user.id), body.question, body.answer);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'FAQ 삭제' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.faqsService.delete(BigInt(id), BigInt(user.id));
  }
}
