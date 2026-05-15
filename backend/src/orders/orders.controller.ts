import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '주문 목록 조회' })
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('projectId') projectId?: number,
  ) {
    return this.ordersService.findAll(BigInt(user.id), {
      status,
      search,
      page,
      limit,
      projectId,
    });
  }

  @Get('orders/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '주문 전체 내보내기 (엑셀용)' })
  async exportAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('projectId') projectId?: number,
  ) {
    return this.ordersService.exportAll(BigInt(user.id), { status, projectId });
  }

  @Get('orders/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '대시보드 통계' })
  async getDashboardStats(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: number,
  ) {
    return this.ordersService.getDashboardStats(
      BigInt(user.id),
      projectId ? BigInt(projectId) : undefined,
    );
  }

  @Get('orders/recent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '최근 주문' })
  async getRecentOrders(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: number,
  ) {
    return this.ordersService.getRecentOrders(
      BigInt(user.id),
      projectId ? BigInt(projectId) : undefined,
    );
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '주문 상세 조회' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findById(BigInt(id), BigInt(user.id));
  }

  @Put('orders/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '주문 상태 변경' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(
      BigInt(id),
      BigInt(user.id),
      status,
    );
  }

  @Post('public/orders/:slug')
  @ApiOperation({ summary: '공개 주문폼 주문 생성' })
  async createPublicOrder(
    @Param('slug') slug: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createPublicOrder(slug, dto);
  }
}
