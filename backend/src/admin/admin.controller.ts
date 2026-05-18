import {
  Controller, Get, Patch, Param, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: '관리자 대시보드 통계' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: '사용자 목록 (구독 포함)' })
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search = '',
  ) {
    return this.adminService.getUsers(page, limit, search);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '사용자 역할 변경' })
  setUserRole(@Param('id', ParseIntPipe) id: number, @Body('role') role: string) {
    return this.adminService.setUserRole(id, role);
  }

  @Get('orders')
  @ApiOperation({ summary: '전체 주문 목록' })
  getOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('search') search = '',
    @Query('status') status = '',
  ) {
    return this.adminService.getOrders(page, limit, search, status);
  }

  @Get('projects')
  @ApiOperation({ summary: '전체 프로젝트 목록' })
  getProjects(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('search') search = '',
  ) {
    return this.adminService.getProjects(page, limit, search);
  }

  @Get('payments')
  @ApiOperation({ summary: '전체 결제 목록' })
  getPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('status') status = '',
  ) {
    return this.adminService.getPayments(page, limit, status);
  }

  @Get('shipments')
  @ApiOperation({ summary: '전체 배송 목록' })
  getShipments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('status') status = '',
  ) {
    return this.adminService.getShipments(page, limit, status);
  }
}
