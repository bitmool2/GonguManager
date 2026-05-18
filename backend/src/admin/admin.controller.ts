import {
  Controller, Get, Patch, Param, Body, Query, UseGuards, ParseIntPipe,
  DefaultValuePipe, ParseFloatPipe, Optional,
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
  getDashboardStats() { return this.adminService.getDashboardStats(); }

  @Get('users')
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search = '',
  ) { return this.adminService.getUsers(page, limit, search); }

  @Patch('users/:id/role')
  setUserRole(@Param('id', ParseIntPipe) id: number, @Body('role') role: string) {
    return this.adminService.setUserRole(id, role);
  }

  @Get('orders')
  getOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('sellerEmail') sellerEmail?: string,
    @Query('projectName') projectName?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('customerName') customerName?: string,
    @Query('phone') phone?: string,
    @Query('orderNumber') orderNumber?: string,
  ) {
    return this.adminService.getOrders(page, limit, {
      search, status, paymentStatus, sellerEmail, projectName,
      dateFrom, dateTo, customerName, phone, orderNumber,
    });
  }

  @Get('projects')
  getProjects(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('name') name?: string,
    @Query('sellerEmail') sellerEmail?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getProjects(page, limit, { name, sellerEmail, status, dateFrom, dateTo });
  }

  @Get('payments')
  getPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('sellerEmail') sellerEmail?: string,
    @Query('orderNumber') orderNumber?: string,
    @Query('customerName') customerName?: string,
    @Query('depositorName') depositorName?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('amountMin') amountMin?: string,
    @Query('amountMax') amountMax?: string,
  ) {
    return this.adminService.getPayments(page, limit, {
      status, sellerEmail, orderNumber, customerName, depositorName, dateFrom, dateTo,
      amountMin: amountMin ? Number(amountMin) : undefined,
      amountMax: amountMax ? Number(amountMax) : undefined,
    });
  }

  @Get('shipments')
  getShipments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('courier') courier?: string,
    @Query('trackingNumber') trackingNumber?: string,
    @Query('sellerEmail') sellerEmail?: string,
    @Query('customerName') customerName?: string,
    @Query('orderNumber') orderNumber?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getShipments(page, limit, {
      status, courier, trackingNumber, sellerEmail, customerName, orderNumber, dateFrom, dateTo,
    });
  }
}
