import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  /* 공개 엔드포인트 — 인증 불필요 */
  @Get('public/:slug')
  @ApiOperation({ summary: '공개 주문폼 프로젝트 정보 조회' })
  async findBySlug(@Param('slug') slug: string) {
    return this.projectsService.findBySlug(slug);
  }

  @Get('check-slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '슬러그 중복 확인' })
  async checkSlug(
    @CurrentUser() user: any,
    @Query('slug') slug: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.projectsService.checkSlugAvailable(slug, excludeId ? BigInt(excludeId) : undefined, user.email);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로젝트 목록' })
  async findAll(@CurrentUser() user: any) {
    return this.projectsService.findAll(BigInt(user.id));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로젝트 상세' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.findById(BigInt(id), BigInt(user.id));
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로젝트 통계' })
  async getStats(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.getStats(BigInt(id), BigInt(user.id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로젝트 생성' })
  async create(@Body() body: any, @CurrentUser() user: any) {
    return this.projectsService.create(BigInt(user.id), body, user.email);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로젝트 수정' })
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.update(BigInt(id), BigInt(user.id), body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로젝트 삭제' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.delete(BigInt(id), BigInt(user.id));
  }
}
