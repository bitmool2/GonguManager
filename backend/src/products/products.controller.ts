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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 목록 조회' })
  async findAll(@CurrentUser() user: any, @Query('projectId') projectId?: string) {
    return this.productsService.findAll(
      BigInt(user.id),
      projectId ? BigInt(projectId) : undefined,
    );
  }

  @Get('public/:slug')
  @ApiOperation({ summary: '공개 주문폼 상품 조회' })
  async findBySlug(@Param('slug') slug: string) {
    const products = await this.productsService.findBySlug(slug);
    return products.map((p) =>
      JSON.parse(
        JSON.stringify(p, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
      ),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 상세 조회' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findById(BigInt(id), BigInt(user.id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 등록' })
  async create(@Body() dto: CreateProductDto & { projectId?: string }, @CurrentUser() user: any) {
    return this.productsService.create(BigInt(user.id), {
      ...dto,
      projectId: dto.projectId ? BigInt(dto.projectId) : null,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 수정' })
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.productsService.update(BigInt(id), BigInt(user.id), dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 삭제' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.delete(BigInt(id), BigInt(user.id));
  }

  /* ── 옵션 ── */

  @Post(':id/options')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '옵션 추가 (최대 3개)' })
  async addOption(
    @Param('id') id: string,
    @Body() body: { optionName: string; stock: number },
    @CurrentUser() user: any,
  ) {
    return this.productsService.addOption(BigInt(id), BigInt(user.id), body.optionName, body.stock);
  }

  @Put(':id/options/:optionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '옵션 수정' })
  async updateOption(
    @Param('optionId') optionId: string,
    @Body() body: { optionName: string; stock: number },
    @CurrentUser() user: any,
  ) {
    return this.productsService.updateOption(BigInt(optionId), BigInt(user.id), body.optionName, body.stock);
  }

  @Delete(':id/options/:optionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '옵션 삭제' })
  async deleteOption(
    @Param('optionId') optionId: string,
    @CurrentUser() user: any,
  ) {
    return this.productsService.deleteOption(BigInt(optionId), BigInt(user.id));
  }

  /* ── 상품 상세 파일 ── */

  @Post(':id/detail-file')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '상품 상세 파일 업로드 (txt/pdf)' })
  async uploadDetailFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
    @CurrentUser() user: any,
  ) {
    if (!file && !description) throw new BadRequestException('파일 또는 설명 중 하나는 필요합니다.');

    // Multer가 Latin-1로 수신한 원래 파일명을 UTF-8로 재해석
    const fileName = file
      ? Buffer.from(file.originalname, 'latin1').toString('utf8')
      : undefined;

    return this.productsService.upsertDetail(BigInt(id), BigInt(user.id), {
      description,
      fileName,
      fileContent: file ? file.buffer.toString('utf-8') : undefined,
    });
  }

  @Get(':id/detail-file')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 상세 정보 조회' })
  async getDetailFile(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.getDetail(BigInt(id), BigInt(user.id));
  }

  @Delete(':id/detail-file')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 상세 정보 삭제' })
  async deleteDetailFile(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.deleteDetail(BigInt(id), BigInt(user.id));
  }
}
