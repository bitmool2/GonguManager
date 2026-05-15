import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ShipmentsService } from './shipments.service';

@ApiTags('Shipments')
@Controller('shipments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShipmentsController {
  constructor(private shipmentsService: ShipmentsService) {}

  @Get()
  @ApiOperation({ summary: '배송 목록 조회' })
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('projectId') projectId?: number,
  ) {
    return this.shipmentsService.findAll(BigInt(user.id), status, projectId);
  }

  @Get('summary')
  @ApiOperation({ summary: '배송 요약' })
  async getSummary(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: number,
  ) {
    return this.shipmentsService.getSummary(BigInt(user.id), projectId);
  }

  @Put(':id/tracking')
  @ApiOperation({ summary: '송장 등록' })
  async registerTracking(
    @Param('id') id: string,
    @Body() body: { courier: string; trackingNumber: string },
    @CurrentUser() user: any,
  ) {
    return this.shipmentsService.registerTracking(
      BigInt(id),
      BigInt(user.id),
      body.courier,
      body.trackingNumber,
    );
  }

  @Put(':id/status')
  @ApiOperation({ summary: '배송 상태 변경' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.shipmentsService.updateStatus(
      BigInt(id),
      BigInt(user.id),
      status,
    );
  }
}
